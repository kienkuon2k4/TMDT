import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/fixture.mjs';
import {allocate} from '../server/commerce.mjs';
import {backupDatabase} from '../server/backup.mjs';
import {openDatabase} from '../server/database.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const post=(c,path,body)=>c.request(path,'POST',body);
const add=(c,skuId,qty=1)=>post(c,'/cart/items',{skuId,qty});
const versions=new WeakMap();
async function checkout(c,key,body={}){if(!versions.has(c))versions.set(c,new Map());const cache=versions.get(c);if(!cache.has(key))cache.set(key,post(c,'/checkout/quote',body));const q=await cache.get(key);if(q.status!==200)return q;return c.request('/checkout','POST',{addressId:'a1',payment:'COD',quoteVersion:q.data.version,...body},{'Idempotency-Key':key});}
async function coupon(admin,code,extra={}){const today=new Date().toISOString().slice(0,10);return post(admin,'/admin/coupons',{code,amount:100000,minimum:1000000,maxUses:100,start:today,end:'2099-12-31',...extra});}

test('allocation preserves exact VND even for large integer prices',()=>{const result=allocate(99999999,[99000000000,98000000000,1]);assert.equal(result.reduce((n,x)=>n+x,0),99999999);assert.ok(result.every(x=>Number.isSafeInteger(x)&&x>=0));assert.deepEqual(allocate(1,[1,1]),[1,0]);});

test('backup retains committed cart, orders, item snapshots and stock after reopening',async t=>{
  const {db,client}=await fixture(t),buyer=client();await buyer.login();await add(buyer,'air-0');await checkout(buyer,'backup-order');await add(buyer,'oxford-1');
  const dir=mkdtempSync(path.join(os.tmpdir(),'cho-ptit-backup-test-')),filename=path.join(dir,'snapshot.sqlite');
  try{backupDatabase(db,filename);const restored=openDatabase(filename);try{assert.equal(restored.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(restored.prepare('SELECT price FROM order_items').get().price,890000);assert.equal(restored.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,23);assert.equal(restored.prepare('SELECT sku_id FROM cart_items').get().sku_id,'oxford-1');}finally{restored.close();}assert.throws(()=>backupDatabase(db,filename),/đã tồn tại/);}finally{const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('cho-ptit-backup-test-'));rmSync(resolved,{recursive:true,force:true});}
});

test('a seller cannot buy its own product or complete an order on behalf of a buyer',async t=>{
  const {client}=await fixture(t),seller=client(),buyer=client();await seller.login('seller@nep.local');await buyer.login();assert.equal((await add(seller,'air-0')).status,400);
  await add(buyer,'air-0');await checkout(buyer,'seller-cancel');const o=(await buyer.request('/bootstrap')).data.orders[0];
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Hoàn thành'})).status,409);
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đã hủy',reason:'Không thể thực hiện giao hàng'})).status,200);
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đã hủy',reason:'Duplicate'})).status,409);
});

test('price changes after confirmation require a new quote and cannot silently increase the order amount',async t=>{
  const {db,client}=await fixture(t),buyer=client();await buyer.login();await add(buyer,'air-0');const q=await post(buyer,'/checkout/quote',{});
  db.prepare("UPDATE skus SET price=990000 WHERE id='air-0'").run();
  const stale=await buyer.request('/checkout','POST',{addressId:'a1',payment:'COD',quoteVersion:q.data.version},{'Idempotency-Key':'changed-price'});
  assert.equal(stale.status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,24);
  assert.equal((await checkout(buyer,'new-price')).data.total,1020000);
});

test('SKU cart uses exact selected price, server quote, snapshots and idempotent multi-shop checkout',async t=>{
  const {db,client}=await fixture(t),buyer=client(),admin=client(),other=client();await buyer.login();await admin.login('admin@nep.local');await other.login('seller2@nep.local');
  db.prepare("UPDATE skus SET price=499000 WHERE id='oxford-1'").run();
  assert.equal((await add(buyer,'air-0')).status,200);assert.equal((await add(buyer,'oxford-1')).status,200);
  assert.equal((await add(buyer,'air-0',-1)).status,400);assert.equal((await add(buyer,'air-0',0.5)).status,400);
  assert.equal((await coupon(admin,'PTIT100')).status,201);
  const quote=await post(buyer,'/checkout/quote',{couponCode:'PTIT100'});assert.equal(quote.data.total,1339000);assert.equal(quote.data.groups.find(g=>g.shopId==='mw').items[0].variant,'M');
  const result=await checkout(buyer,'same-order',{couponCode:'PTIT100',total:1,price:1});assert.equal(result.status,201);assert.equal(result.data.total,1339000);
  const repeat=await checkout(buyer,'same-order',{couponCode:'PTIT100',total:1,price:1});assert.equal(repeat.status,201);assert.equal(repeat.data.id,result.data.id);assert.equal(repeat.data.replayed,true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,2);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,23);
  assert.equal((await checkout(buyer,'same-order',{couponCode:''})).status,409);
  const data=(await buyer.request('/bootstrap')).data;assert.equal(data.cart.length,0);assert.equal(data.groups[0].children.length,2);assert.equal(data.orders.find(o=>o.shopId==='mw').items[0].price,499000);
  db.prepare("UPDATE skus SET price=999 WHERE id='oxford-1'").run();assert.equal((await buyer.request('/bootstrap')).data.orders.find(o=>o.shopId==='mw').items[0].price,499000);
  const outside=(await other.request('/bootstrap')).data;assert.equal(outside.orders.some(o=>o.shopId==='kt'),false);assert.equal(outside.cart.length,0);
});

test('concurrent last-SKU requests cannot oversell; failed checkout leaves all cart and stock intact',async t=>{
  const {db,client}=await fixture(t),a=client(),b=client();await a.login();await b.request('/auth/register','POST',{email:'another@example.test',password:'StrongPassword123',name:'Another'});
  await b.request('/addresses','POST',{name:'Another',phone:'0900000000',street:'Another address'});const addressId=(await b.request('/bootstrap')).data.addresses[0].id;
  db.prepare("UPDATE skus SET stock=1 WHERE id='air-0'").run();await add(a,'air-0');await add(a,'notebook-0');await add(b,'air-0');
  const results=await Promise.all([checkout(a,'concurrent-a'),checkout(b,'concurrent-b',{addressId})]);assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
  assert.equal(db.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,0);
  const loser=results[0].status===409?a:b;assert.ok((await loser.request('/bootstrap')).data.cart.length>0);
  if(results[0].status===409)assert.equal(db.prepare("SELECT stock FROM skus WHERE id='notebook-0'").get().stock,24);
});

test('duplicate concurrent submissions create one order and authorization protects private orders',async t=>{
  const {db,client}=await fixture(t),a=client(),b=client();await a.login();await b.login('seller2@nep.local');await add(a,'air-0');
  const [x,y]=await Promise.all([checkout(a,'duplicate'),checkout(a,'duplicate')]);assert.equal(x.status,201);assert.equal(y.status,201);assert.equal(x.data.id,y.data.id);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
  const o=(await a.request('/bootstrap')).data.orders[0];assert.equal((await post(b,'/orders/'+o.id+'/cancel',{})).status,404);
  assert.equal((await b.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang chuẩn bị'})).status,404);
});

test('cancel restores only that shop stock once and releases platform coupon only after entire group cancellation',async t=>{
  const {db,client}=await fixture(t),buyer=client(),admin=client();await buyer.login();await admin.login('admin@nep.local');await coupon(admin,'LASTONE',{maxUses:1});await add(buyer,'air-0');await add(buyer,'oxford-0');await checkout(buyer,'cancel-group',{couponCode:'LASTONE'});
  const orders=(await buyer.request('/bootstrap')).data.orders;const kt=orders.find(o=>o.shopId==='kt'),mw=orders.find(o=>o.shopId==='mw');
  assert.equal((await post(buyer,'/orders/'+kt.id+'/cancel',{})).status,200);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,24);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='oxford-0'").get().stock,23);
  assert.equal((await post(buyer,'/orders/'+kt.id+'/cancel',{})).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM coupon_uses').get().n,1);
  await post(buyer,'/orders/'+mw.id+'/cancel',{});assert.equal(db.prepare('SELECT COUNT(*) n FROM coupon_uses').get().n,0);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='oxford-0'").get().stock,24);
});

test('COD fulfillment requires seller scope, tracking, buyer receipt, and verified purchase review',async t=>{
  const {client}=await fixture(t),buyer=client(),seller=client(),outside=client();await buyer.login();await seller.login('seller@nep.local');await outside.login('seller2@nep.local');await add(buyer,'air-0');await checkout(buyer,'fulfill');let o=(await buyer.request('/bootstrap')).data.orders[0];
  assert.equal((await post(buyer,'/orders/'+o.id+'/received',{})).status,409);assert.equal((await post(buyer,'/reviews',{itemId:o.items[0].id,rating:5,body:'Not received yet'})).status,403);
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang chuẩn bị'})).status,200);
  assert.equal((await post(buyer,'/orders/'+o.id+'/cancel',{})).status,409);o=(await buyer.request('/bootstrap')).data.orders[0];
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang giao'})).status,400);
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang giao',carrier:'Carrier',tracking:'REAL-REF-123'})).status,200);
  assert.equal((await post(buyer,'/orders/'+o.id+'/received',{})).status,200);assert.equal((await post(buyer,'/orders/'+o.id+'/received',{})).status,409);
  o=(await buyer.request('/bootstrap')).data.orders[0];assert.equal(o.paymentStatus,'Đã thu');assert.equal(o.history.length,4);
  assert.equal((await post(outside,'/reviews',{itemId:o.items[0].id,rating:5,body:'Another buyer'})).status,403);
  assert.equal((await post(buyer,'/reviews',{itemId:o.items[0].id,rating:5,body:'Đúng phân loại đã đặt.'})).status,201);
  assert.equal((await post(buyer,'/reviews',{itemId:o.items[0].id,rating:5,body:'Duplicate'})).status,409);
  assert.equal((await buyer.request('/bootstrap')).data.report.collected,920000);
  assert.ok((await seller.request('/bootstrap')).data.notifications.length>0);
});

test('last voucher use is atomic and hidden/locked products cannot be checked out',async t=>{
  const {db,client}=await fixture(t),a=client(),b=client(),admin=client();await a.login();await b.login('seller2@nep.local');await admin.login('admin@nep.local');
  await b.request('/addresses','POST',{name:'Seller buyer',phone:'0900000000',street:'Address'});const addressId=(await b.request('/bootstrap')).data.addresses[0].id;
  await coupon(admin,'ONLYONE',{maxUses:1,minimum:0,amount:10000});await add(a,'air-0');await add(b,'air-0');
  const results=await Promise.all([checkout(a,'voucher-a',{couponCode:'ONLYONE'}),checkout(b,'voucher-b',{couponCode:'ONLYONE',addressId})]);assert.deepEqual(results.map(x=>x.status).sort(),[201,400]);assert.equal(db.prepare('SELECT COUNT(*) n FROM coupon_uses').get().n,1);
  const loser=results[0].status!==201?a:b;assert.equal((await admin.request('/admin/shops/kt','PATCH',{status:'Đã khóa',reason:'Suspended for review'})).status,200);
  const denied=await checkout(loser,'locked',{addressId:loser===a?'a1':addressId});assert.equal(denied.status,409);
});

test('returns follow receipt, explicit restock and refund evidence without duplicate inventory or refund',async t=>{
  const {db,client}=await fixture(t),buyer=client(),seller=client(),admin=client();await buyer.login();await seller.login('seller@nep.local');await admin.login('admin@nep.local');await add(buyer,'air-0');await checkout(buyer,'return-flow');let o=(await buyer.request('/bootstrap')).data.orders[0];
  await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang chuẩn bị'});o=(await buyer.request('/bootstrap')).data.orders[0];await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang giao',carrier:'Carrier',tracking:'REF-1'});await post(buyer,'/orders/'+o.id+'/received',{});
  assert.equal((await post(buyer,'/returns',{itemId:o.items[0].id,reason:'Lỗi',description:'Sản phẩm lỗi kỹ thuật'})).status,201);let r=(await buyer.request('/bootstrap')).data.returns[0];assert.equal(r.amount,890000);
  assert.equal((await seller.request('/returns/'+r.id,'PATCH',{action:'accept'})).status,200);
  assert.equal((await seller.request('/returns/'+r.id,'PATCH',{action:'returned',restock:true})).status,200);assert.equal(db.prepare("SELECT stock FROM skus WHERE id='air-0'").get().stock,24);
  assert.equal((await seller.request('/returns/'+r.id,'PATCH',{action:'returned',restock:true})).status,409);
  assert.equal((await admin.request('/returns/'+r.id,'PATCH',{action:'refunded'})).status,400);
  assert.equal((await admin.request('/returns/'+r.id,'PATCH',{action:'refunded',reference:'Verified refund receipt 123'})).status,200);
  assert.equal((await admin.request('/returns/'+r.id,'PATCH',{action:'refunded',reference:'Duplicate'})).status,409);
  const data=(await admin.request('/bootstrap')).data;assert.equal(data.report.refunds,890000);assert.equal(data.report.netCollected,30000);
});

test('catalog, favorites, notification reads, category edits and cart rows are account scoped',async t=>{
  const {client}=await fixture(t),buyer=client(),other=client(),admin=client();await buyer.login();await other.login('seller2@nep.local');await admin.login('admin@nep.local');
  assert.equal((await buyer.request('/favorites/air','PUT',{})).status,200);assert.deepEqual((await buyer.request('/bootstrap')).data.favorites,['air']);assert.deepEqual((await other.request('/bootstrap')).data.favorites,[]);
  assert.equal((await buyer.request('/catalog?min=400000&max=100')).status,400);
  const search=await buyer.request('/catalog?q=Oxford&min=300000&max=400000&page=1');assert.equal(search.status,200);assert.equal(search.data.total,1);assert.equal(search.data.items[0].id,'oxford');
  assert.equal((await admin.request('/admin/categories/'+encodeURIComponent('Điện tử'),'PUT',{name:'Điện tử & công nghệ'})).status,200);
  assert.equal((await admin.request('/admin/categories/'+encodeURIComponent('Điện tử & công nghệ'),'DELETE',{})).status,409);
  assert.equal((await buyer.request('/catalog?category='+encodeURIComponent('Điện tử & công nghệ'))).data.items[0].id,'air');
});

test('locked shops cannot sell new items but retain access to fulfill existing orders',async t=>{
  const {client}=await fixture(t),buyer=client(),seller=client(),admin=client();await buyer.login();await seller.login('seller@nep.local');await admin.login('admin@nep.local');await add(buyer,'air-0');await checkout(buyer,'before-lock');const o=(await buyer.request('/bootstrap')).data.orders[0];
  assert.equal((await admin.request('/admin/shops/kt','PATCH',{status:'Đã khóa',reason:'Rà soát hồ sơ'})).status,200);
  assert.equal((await add(buyer,'air-0')).status,409);
  assert.equal((await seller.request('/seller/orders/'+o.id,'PATCH',{version:o.version,status:'Đang chuẩn bị'})).status,200);
  assert.equal((await admin.request('/admin/shops/kt','PATCH',{status:'Đang hoạt động',reason:'Đã rà soát'})).status,200);assert.equal((await add(buyer,'air-0')).status,200);
});

test('rejected seller applications can be corrected without creating another shop',async t=>{
  const {db,client}=await fixture(t),buyer=client(),admin=client();await buyer.login();await admin.login('admin@nep.local');const body={name:'Shop cần bổ sung',owner:'Buyer',legalName:'Buyer',category:'Thời trang',bank:'Account'};
  const created=await post(buyer,'/applications',body);const id=created.data.id;
  assert.equal((await admin.request('/admin/applications/'+id,'PATCH',{decision:'reject',reason:'Thiếu thông tin chủ sở hữu'})).status,200);
  assert.equal((await post(buyer,'/applications',{...body,id,legalName:'Tên đã bổ sung'})).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM applications WHERE user_id=?').get('buyer').n,1);
  assert.equal((await admin.request('/admin/applications/'+id,'PATCH',{decision:'approve'})).status,200);
  const state=(await buyer.request('/bootstrap')).data;assert.equal(state.user.role,'seller');assert.ok(state.notifications.some(n=>n.text.includes('Đã duyệt')));
});
