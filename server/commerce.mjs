import {randomUUID} from 'node:crypto';
import {transaction,audit} from './database.mjs';
import {HttpError,text,integer,digest} from './security.mjs';
const id=p=>p+randomUUID();
const fail=(status,message)=>{throw new HttpError(status,message);};
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

// Largest-remainder allocation keeps every VND and does not depend on float rounding.
export function allocate(amount,weights){const total=weights.reduce((a,b)=>a+BigInt(b),0n);if(!total)return weights.map(()=>0);const numerators=weights.map(w=>BigInt(amount)*BigInt(w)),shares=numerators.map(n=>Number(n/total));let rest=amount-shares.reduce((a,b)=>a+b,0);const indices=numerators.map((n,i)=>({i,remainder:n%total})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);for(const {i} of indices){if(!rest)break;shares[i]++;rest--;}return shares;}

export function createCommerce(db){
  function notify(userId,message,path){db.prepare('INSERT INTO notifications(id,user_id,text,path) VALUES(?,?,?,?)').run(id('N'),userId,message,path);}
  function sku(skuId){return db.prepare(`SELECT k.*,p.name,p.shop_id,p.image,p.photo,p.visible,p.moderation,s.name shop_name,s.status shop_status,s.shipping,s.owner_id FROM skus k JOIN products p ON p.id=k.product_id JOIN shops s ON s.id=p.shop_id WHERE k.id=?`).get(skuId);}
  function cart(user){if(!user)return [];return db.prepare('SELECT sku_id,qty FROM cart_items WHERE user_id=? ORDER BY sku_id').all(user.id).map(x=>{const p=sku(x.sku_id);return {id:p.product_id,skuId:p.id,name:p.name,variant:p.label,sku:p.code,price:p.price,qty:x.qty,stock:p.stock,image:p.image,photo:p.photo,shopId:p.shop_id,shopName:p.shop_name,shipping:p.shipping,available:!!p.visible&&p.moderation==='approved'&&p.shop_status==='Đang hoạt động'&&p.owner_id!==user.id&&p.stock>=x.qty};});}
  function coupon(code,shopId,subtotal){if(!code)return null;code=text(code,'Mã ưu đãi',50).toUpperCase();const c=db.prepare('SELECT * FROM coupons WHERE code=?').get(code);const used=c?db.prepare('SELECT COUNT(*) n FROM coupon_uses WHERE code=?').get(code).n:0;if(!c||!c.enabled||c.shop_id!==(shopId||null)||c.starts_at>day()||c.ends_at<day()||used>=c.max_uses||subtotal<c.minimum)fail(400,`Mã ${code} không hợp lệ, hết lượt hoặc chưa đủ điều kiện.`);return c;}
  function quote(user,{couponCode='',shopCoupons={}}={},strict=false){
    if(!shopCoupons||typeof shopCoupons!=='object'||Array.isArray(shopCoupons))fail(400,'Ưu đãi shop không hợp lệ.');
    const items=cart(user),groups=[];if(strict&&(!items.length||items.some(x=>!x.available)))fail(409,items.length?'Có sản phẩm ngừng bán hoặc không đủ tồn kho.':'Giỏ hàng đang trống.');
    for(const x of items){let g=groups.find(g=>g.shopId===x.shopId);if(!g){g={shopId:x.shopId,name:x.shopName,shipping:x.shipping,items:[],subtotal:0,discount:0};groups.push(g);}g.items.push({...x,discount:0});g.subtotal+=x.price*x.qty;}
    groups.sort((a,b)=>a.shopId.localeCompare(b.shopId));const applied=[];
    for(const g of groups){const c=coupon(shopCoupons[g.shopId]||'',g.shopId,g.subtotal);if(c){const amount=Math.min(c.amount,g.subtotal),parts=allocate(amount,g.items.map(x=>x.price*x.qty));g.items.forEach((x,i)=>x.discount=parts[i]);applied.push({code:c.code,shopId:g.shopId});}}
    const lines=groups.flatMap(g=>g.items),remaining=lines.reduce((n,x)=>n+x.price*x.qty-x.discount,0),platform=coupon(couponCode,null,remaining);
    if(platform){const parts=allocate(Math.min(platform.amount,remaining),lines.map(x=>x.price*x.qty-x.discount));lines.forEach((x,i)=>x.discount+=parts[i]);applied.push({code:platform.code,shopId:null});}
    groups.forEach(g=>{g.discount=g.items.reduce((n,x)=>n+x.discount,0);g.total=g.subtotal+g.shipping-g.discount;});
    const subtotal=groups.reduce((n,g)=>n+g.subtotal,0),shipping=groups.reduce((n,g)=>n+g.shipping,0),discount=groups.reduce((n,g)=>n+g.discount,0);
    const version=digest(JSON.stringify(groups.map(g=>({shopId:g.shopId,shipping:g.shipping,items:g.items.map(x=>({skuId:x.skuId,qty:x.qty,price:x.price,discount:x.discount}))}))));
    return {version,groups,items,subtotal,shipping,discount,total:subtotal+shipping-discount,valid:items.length>0&&items.every(x=>x.available),applied};
  }
  function readOrders(user){if(!user)return [];const rows=db.prepare(`SELECT o.* FROM orders o JOIN shops s ON s.id=o.shop_id WHERE o.buyer_id=? OR (?='seller' AND s.owner_id=?) OR ?='admin' ORDER BY o.created_at DESC,o.rowid DESC`).all(user.id,user.role,user.id,user.role);return rows.map(o=>({id:o.id,groupId:o.group_id,buyerId:o.buyer_id,shopId:o.shop_id,name:o.shop_name,customer:o.customer,phone:o.phone,address:o.address,note:o.note,subtotal:o.subtotal,shipping:o.shipping,discount:o.discount,total:o.total,status:o.status,payment:o.payment_method,paymentStatus:o.payment_status,carrier:o.carrier,tracking:o.tracking,version:o.version,date:o.created_at+'Z',items:db.prepare('SELECT id,product_id AS productId,sku_id AS skuId,name,variant,sku_code AS sku,price,qty,discount FROM order_items WHERE order_id=?').all(o.id),history:db.prepare('SELECT status,note,created_at AS date FROM order_history WHERE order_id=? ORDER BY id').all(o.id)}));}
  function snapshot(user){const orders=readOrders(user),groups=user?db.prepare('SELECT id,total,created_at AS date FROM order_groups WHERE user_id=? ORDER BY rowid DESC').all(user.id).map(g=>({...g,children:db.prepare('SELECT id FROM orders WHERE group_id=?').all(g.id).map(x=>x.id)})):[];return {businessDate:day(),cart:cart(user),cartTotals:quote(user),orders,groups,favorites:user?db.prepare('SELECT product_id FROM favorites WHERE user_id=?').all(user.id).map(x=>x.product_id):[],notifications:user?db.prepare('SELECT id,text,path,is_read AS read,created_at AS date FROM notifications WHERE user_id=? ORDER BY rowid DESC LIMIT 100').all(user.id).map(x=>({...x,read:!!x.read})):[],returns:user?db.prepare(`SELECT r.id,r.order_id AS orderId,r.item_id AS itemId,r.buyer_id AS buyerId,r.shop_id AS shopId,r.reason,r.description,r.amount,r.status,r.dispute,r.refund_reference AS refundReference FROM return_requests r JOIN shops s ON s.id=r.shop_id WHERE r.buyer_id=? OR (?='seller' AND s.owner_id=?) OR ?='admin' ORDER BY r.rowid DESC`).all(user.id,user.role,user.id,user.role).map(r=>({...r,history:db.prepare('SELECT status,note,created_at AS date FROM return_history WHERE return_id=? ORDER BY id').all(r.id)})):[],coupons:db.prepare("SELECT code,shop_id AS shopId,amount,minimum,max_uses AS maxUses,max_uses-(SELECT COUNT(*) FROM coupon_uses WHERE coupon_uses.code=coupons.code) AS remaining,starts_at AS start,ends_at AS end,enabled FROM coupons WHERE (?='admin') OR (enabled=1 AND ends_at>=?)").all(user?.role||'',day()),reviews:db.prepare('SELECT r.id,r.product_id AS productId,r.order_item_id AS itemId,r.rating,r.body,u.name,r.created_at AS date FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.rowid DESC LIMIT 500').all(),audit:user?.role==='admin'?db.prepare('SELECT id,user_id AS userId,action,target_id AS targetId,details,created_at AS date FROM audit ORDER BY id DESC LIMIT 200').all():[],report:report(user,orders),unreadCount:user?db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0').get(user.id).n:0};}
  function report(user,orders){
    const scoped=user?.role==='seller'?orders.filter(o=>db.prepare('SELECT owner_id FROM shops WHERE id=?').get(o.shopId)?.owner_id===user.id):orders;
    const refunds=user?db.prepare("SELECT COALESCE(SUM(r.amount),0) total FROM return_requests r JOIN orders o ON o.id=r.order_id JOIN shops sh ON sh.id=o.shop_id WHERE r.status='Đã hoàn tiền' AND ((?='seller' AND sh.owner_id=?) OR ?='admin' OR (?='buyer' AND o.buyer_id=?))").get(user.role,user.id,user.role,user.role,user.id).total:0;
    const paid=scoped.filter(o=>o.paymentStatus==='Đã thu'),collected=paid.reduce((n,o)=>n+o.total,0);
    return {orderCount:scoped.length,completed:paid.length,merchandisePaid:paid.reduce((n,o)=>n+o.subtotal-o.discount,0),shippingPaid:paid.reduce((n,o)=>n+o.shipping,0),refunds,collected,netCollected:collected-refunds,byShop:[...new Set(scoped.map(o=>o.shopId))].map(shopId=>{const os=scoped.filter(o=>o.shopId===shopId);return {shopId,name:os[0].name,orders:os.length,paid:os.filter(o=>o.paymentStatus==='Đã thu').reduce((n,o)=>n+o.total,0)};})};
  }
  function history(order,user,status,note=''){db.prepare('INSERT INTO order_history(order_id,actor_id,status,note) VALUES(?,?,?,?)').run(order.id,user.id,status,note);notify(order.buyer_id,`Đơn ${order.id}: ${status}`,'order/'+order.id);const owner=db.prepare('SELECT owner_id FROM shops WHERE id=?').get(order.shop_id);if(owner.owner_id!==user.id)notify(owner.owner_id,`Đơn ${order.id}: ${status}`,'seller/order/'+order.id);audit(db,user,'order_status',order.id,{status,note});}
  function ownedOrder(user,orderId,who){const o=db.prepare('SELECT o.*,s.owner_id FROM orders o JOIN shops s ON s.id=o.shop_id WHERE o.id=?').get(orderId);if(!o||(who==='buyer'?o.buyer_id!==user.id:who==='seller'?user.role!=='seller'||o.owner_id!==user.id:user.role!=='admin'))fail(404,'Không tìm thấy đơn hàng.');return o;}
  function releaseCoupons(groupId){for(const c of db.prepare('SELECT code,shop_id FROM coupon_uses WHERE group_id=?').all(groupId)){const count=c.shop_id?db.prepare("SELECT COUNT(*) n FROM orders WHERE group_id=? AND shop_id=? AND status<>'Đã hủy'").get(groupId,c.shop_id).n:db.prepare("SELECT COUNT(*) n FROM orders WHERE group_id=? AND status<>'Đã hủy'").get(groupId).n;if(!count)db.prepare('DELETE FROM coupon_uses WHERE code=? AND group_id=?').run(c.code,groupId);}}
  function cancelOrder(o,user,note=''){
    db.prepare("UPDATE orders SET status='Đã hủy',version=version+1 WHERE id=?").run(o.id);
    for(const x of db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)){db.prepare('UPDATE skus SET stock=stock+? WHERE id=?').run(x.qty,x.sku_id);db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(x.product_id);audit(db,user,'inventory_cancel',x.sku_id,{qty:x.qty,orderId:o.id});}
    releaseCoupons(o.group_id);history(o,user,'Đã hủy',note);
  }
  function checkout(user,d,key){
    key=text(key,'Mã yêu cầu đặt hàng',100);const addressId=text(d.addressId,'Địa chỉ nhận hàng',100);if(d.payment!=='COD')fail(400,'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).');
    const notes=d.notes||{};if(typeof notes!=='object'||Array.isArray(notes)||Object.keys(notes).length>100)fail(400,'Ghi chú không hợp lệ.');for(const value of Object.values(notes))text(value,'Ghi chú',500,false);
    const quoteVersion=text(d.quoteVersion,'Phiên bản giá thanh toán',64);const body={addressId,quoteVersion,payment:'COD',couponCode:d.couponCode||'',shopCoupons:d.shopCoupons||{},notes},fingerprint=digest(JSON.stringify(body));
    return transaction(db,()=>{
      const old=db.prepare('SELECT * FROM order_groups WHERE user_id=? AND idempotency_key=?').get(user.id,key);if(old){if(old.request_hash!==fingerprint)fail(409,'Mã yêu cầu đã được sử dụng cho đơn khác.');return {id:old.id,total:old.total,replayed:true};}
      const a=db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(addressId,user.id);if(!a)fail(400,'Địa chỉ nhận hàng không thuộc tài khoản của bạn.');
      const t=quote(user,body,true);if(t.version!==quoteVersion)fail(409,'Giá, phí hoặc ưu đãi đã thay đổi. Vui lòng kiểm tra lại trước khi đặt hàng.');const groupId=id('MG-');
      db.prepare('INSERT INTO order_groups(id,user_id,idempotency_key,request_hash,subtotal,shipping,discount,total) VALUES(?,?,?,?,?,?,?,?)').run(groupId,user.id,key,fingerprint,t.subtotal,t.shipping,t.discount,t.total);
      for(const g of t.groups){
        const orderId=id('DH-');db.prepare('INSERT INTO orders(id,group_id,buyer_id,shop_id,shop_name,customer,phone,address,note,subtotal,shipping,discount,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId,groupId,user.id,g.shopId,g.name,a.name,a.phone,a.street,notes[g.shopId]||'',g.subtotal,g.shipping,g.discount,g.total);
        for(const x of g.items){const changed=db.prepare('UPDATE skus SET stock=stock-? WHERE id=? AND stock>=?').run(x.qty,x.skuId,x.qty);if(changed.changes!==1)fail(409,'Sản phẩm vừa hết hàng. Vui lòng kiểm tra lại.');db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(x.id);db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?,?,?,?,?)').run(id('IT-'),orderId,x.skuId,x.id,x.name,x.variant,x.sku,x.price,x.qty,x.discount);audit(db,user,'inventory_sale',x.skuId,{qty:x.qty,orderId});}
        history({id:orderId,buyer_id:user.id,shop_id:g.shopId},user,'Chờ xác nhận');
      }
      for(const c of t.applied)db.prepare('INSERT INTO coupon_uses VALUES(?,?,?)').run(c.code,groupId,c.shopId);
      db.prepare('DELETE FROM cart_items WHERE user_id=?').run(user.id);audit(db,user,'checkout',groupId,{total:t.total});return {id:groupId,total:t.total,replayed:false};
    });
  }
  async function handle({route,method,user,d={},req,json}){
    if(!user)fail(401,'Vui lòng đăng nhập.');
    if(route==='/api/cart/items'&&method==='POST'){
      const skuId=text(d.skuId,'Phân loại',100),qty=integer(d.qty,'Số lượng',1,99);
      transaction(db,()=>{const p=sku(skuId);if(!p||!p.visible||p.moderation!=='approved'||p.shop_status!=='Đang hoạt động')fail(409,'Sản phẩm không còn được bán.');if(p.owner_id===user.id)fail(400,'Không thể mua sản phẩm thuộc gian hàng của bạn.');const old=db.prepare('SELECT qty FROM cart_items WHERE user_id=? AND sku_id=?').get(user.id,skuId)?.qty||0;if(old+qty>Math.min(99,p.stock))fail(409,'Số lượng vượt tồn kho hoặc giới hạn 99 sản phẩm.');if(!old&&db.prepare('SELECT COUNT(*) n FROM cart_items WHERE user_id=?').get(user.id).n>=100)fail(400,'Giỏ hàng tối đa 100 phân loại.');db.prepare('INSERT INTO cart_items VALUES(?,?,?) ON CONFLICT(user_id,sku_id) DO UPDATE SET qty=excluded.qty').run(user.id,skuId,old+qty);});json({ok:true});return true;
    }
    if(route.startsWith('/api/cart/items/')&&['PATCH','DELETE'].includes(method)){const skuId=route.split('/')[4];if(method==='DELETE')db.prepare('DELETE FROM cart_items WHERE user_id=? AND sku_id=?').run(user.id,skuId);else{const qty=integer(d.qty,'Số lượng',1,99),p=sku(skuId);if(!p||p.stock<qty||!p.visible||p.moderation!=='approved'||p.shop_status!=='Đang hoạt động')fail(409,'Phân loại không còn đủ hàng để mua.');const changed=db.prepare('UPDATE cart_items SET qty=? WHERE user_id=? AND sku_id=?').run(qty,user.id,skuId);if(!changed.changes)fail(404,'Không tìm thấy sản phẩm trong giỏ.');}json({ok:true});return true;}
    if(route==='/api/checkout/quote'&&method==='POST'){json(quote(user,d));return true;}
    if(route==='/api/checkout'&&method==='POST'){json(checkout(user,d,req.headers['idempotency-key']),201);return true;}
    if(route.startsWith('/api/orders/')&&method==='POST'){
      const [, , ,orderId,action]=route.split('/');transaction(db,()=>{
        const o=ownedOrder(user,orderId,'buyer');
        if(action==='cancel'){
          if(o.status!=='Chờ xác nhận')fail(409,'Chỉ có thể hủy đơn đang chờ shop xác nhận.');
          cancelOrder(o,user,'Người mua hủy trước khi xác nhận.');
        }else if(action==='received'){
          if(o.status!=='Đang giao')fail(409,'Đơn chưa ở trạng thái giao hàng.');db.prepare("UPDATE orders SET status='Hoàn thành',payment_status='Đã thu',version=version+1 WHERE id=?").run(o.id);history(o,user,'Hoàn thành','Người mua xác nhận đã nhận hàng và thanh toán COD.');
        }else fail(404,'Thao tác không tồn tại.');
      });json({ok:true});return true;
    }
    if(route.startsWith('/api/seller/orders/')&&method==='PATCH'){
      const orderId=route.split('/')[4];transaction(db,()=>{const o=ownedOrder(user,orderId,'seller');if(o.version!==d.version)fail(409,'Đơn hàng đã thay đổi. Vui lòng tải lại.');if(d.status==='Đã hủy'&&['Chờ xác nhận','Đang chuẩn bị'].includes(o.status)){cancelOrder(o,user,text(d.reason,'Lý do không thể thực hiện đơn',1000));return;}let carrier=o.carrier,tracking=o.tracking;
        if(o.status==='Chờ xác nhận'&&d.status==='Đang chuẩn bị'){}else if(o.status==='Đang chuẩn bị'&&d.status==='Đang giao'){carrier=text(d.carrier,'Đơn vị giao hàng',120);tracking=text(d.tracking,'Mã vận đơn',120);}else fail(409,'Không thể chuyển trạng thái đơn hàng.');
        db.prepare('UPDATE orders SET status=?,carrier=?,tracking=?,version=version+1 WHERE id=?').run(d.status,carrier,tracking,orderId);history(o,user,d.status,tracking?`${carrier} · ${tracking}`:'');});json({ok:true});return true;
    }
    if(route==='/api/reviews'&&method==='POST'){
      const itemId=text(d.itemId,'Dòng đơn hàng',100),rating=integer(d.rating,'Điểm đánh giá',1,5),body=text(d.body,'Nội dung đánh giá',3000);
      transaction(db,()=>{const item=db.prepare('SELECT i.*,o.buyer_id,o.status FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=?').get(itemId);if(!item||item.buyer_id!==user.id||item.status!=='Hoàn thành')fail(403,'Chỉ được đánh giá sản phẩm thuộc đơn đã nhận.');if(db.prepare('SELECT 1 FROM reviews WHERE order_item_id=?').get(itemId))fail(409,'Bạn đã đánh giá sản phẩm này.');db.prepare('INSERT INTO reviews(id,user_id,order_item_id,product_id,rating,body) VALUES(?,?,?,?,?,?)').run(id('RV-'),user.id,itemId,item.product_id,rating,body);});json({ok:true},201);return true;
    }
    if(route.startsWith('/api/favorites/')&&['PUT','DELETE'].includes(method)){const productId=route.split('/')[3];if(method==='PUT'){if(!db.prepare("SELECT 1 FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=? AND p.visible=1 AND p.moderation='approved' AND s.status='Đang hoạt động'").get(productId))fail(404,'Không tìm thấy sản phẩm.');db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)').run(user.id,productId);}else db.prepare('DELETE FROM favorites WHERE user_id=? AND product_id=?').run(user.id,productId);json({ok:true});return true;}
    if(route==='/api/notifications/read'&&method==='POST'){db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(user.id);json({ok:true});return true;}
    if(route==='/api/admin/coupons'&&method==='POST'){
      if(user.role!=='admin')fail(403,'Bạn không có quyền.');const code=text(d.code,'Mã ưu đãi',50).toUpperCase();if(!/^[A-Z0-9_-]{3,50}$/.test(code))fail(400,'Mã chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.');const start=text(d.start,'Ngày bắt đầu',10),end=text(d.end,'Ngày kết thúc',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)fail(400,'Khoảng ngày không hợp lệ.');if([start,end].some(v=>!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v))fail(400,'Ngày không hợp lệ.');const shopId=d.shopId||null;if(shopId&&!db.prepare("SELECT 1 FROM shops WHERE id=? AND status='Đang hoạt động'").get(shopId))fail(400,'Gian hàng không hợp lệ.');
      db.prepare('INSERT INTO coupons(code,shop_id,amount,minimum,max_uses,starts_at,ends_at) VALUES(?,?,?,?,?,?,?)').run(code,shopId,integer(d.amount,'Mức giảm',1,100000000),integer(d.minimum,'Giá trị tối thiểu'),integer(d.maxUses,'Số lượt',1,1000000),start,end);audit(db,user,'coupon_create',code);json({ok:true},201);return true;
    }
    if(route.startsWith('/api/admin/coupons/')&&method==='PATCH'){if(user.role!=='admin')fail(403,'Bạn không có quyền.');if(typeof d.enabled!=='boolean')fail(400,'Trạng thái không hợp lệ.');db.prepare('UPDATE coupons SET enabled=? WHERE code=?').run(d.enabled?1:0,route.split('/')[4]);audit(db,user,'coupon_toggle',route.split('/')[4]);json({ok:true});return true;}
    if(route==='/api/returns'&&method==='POST'){
      const itemId=text(d.itemId,'Sản phẩm cần trả',100),reason=text(d.reason,'Lý do',300),description=text(d.description,'Mô tả',3000);
      transaction(db,()=>{const x=db.prepare('SELECT i.*,o.buyer_id,o.shop_id,o.status,o.created_at FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.id=?').get(itemId);if(!x||x.buyer_id!==user.id||x.status!=='Hoàn thành')fail(403,'Chỉ có thể yêu cầu trả hàng đã nhận.');const complete=db.prepare("SELECT created_at FROM order_history WHERE order_id=? AND status='Hoàn thành' ORDER BY id DESC LIMIT 1").get(x.order_id);if(!complete||Date.now()-Date.parse(complete.created_at+'Z')>7*86400000)fail(400,'Đã quá thời hạn yêu cầu trả hàng 7 ngày.');const requestId=id('RT-');db.prepare('INSERT INTO return_requests(id,order_id,item_id,buyer_id,shop_id,reason,description,amount) VALUES(?,?,?,?,?,?,?,?)').run(requestId,x.order_id,x.id,user.id,x.shop_id,reason,description,x.price*x.qty-x.discount);db.prepare("INSERT INTO return_history(return_id,actor_id,status) VALUES(?,?,'Chờ shop xử lý')").run(requestId,user.id);notify(db.prepare('SELECT owner_id FROM shops WHERE id=?').get(x.shop_id).owner_id,'Có yêu cầu trả hàng mới','seller/returns');audit(db,user,'return_request',requestId);});json({ok:true},201);return true;
    }
    if(route.startsWith('/api/returns/')&&method==='PATCH'){
      const requestId=route.split('/')[3];transaction(db,()=>{const r=db.prepare('SELECT r.*,s.owner_id FROM return_requests r JOIN shops s ON s.id=r.shop_id WHERE r.id=?').get(requestId);if(!r)fail(404,'Không tìm thấy yêu cầu.');const seller=user.role==='seller'&&r.owner_id===user.id,admin=user.role==='admin';if(r.buyer_id!==user.id&&!seller&&!admin)fail(404,'Không tìm thấy yêu cầu.');let status;
        if(d.action==='dispute'&&r.buyer_id===user.id&&['Chờ shop xử lý','Shop từ chối'].includes(r.status)){status='Chờ sàn giải quyết';db.prepare('UPDATE return_requests SET dispute=1 WHERE id=?').run(r.id);}
        else if(d.action==='accept'&&(seller||admin)&&['Chờ shop xử lý','Chờ sàn giải quyết'].includes(r.status))status='Chờ nhận hàng trả';
        else if(d.action==='reject'&&seller&&r.status==='Chờ shop xử lý'){text(d.reason,'Lý do từ chối',1000);status='Shop từ chối';}
        else if(d.action==='returned'&&seller&&r.status==='Chờ nhận hàng trả'){status='Chờ hoàn tiền';if(d.restock===true&&!r.restocked){const item=db.prepare('SELECT * FROM order_items WHERE id=?').get(r.item_id);db.prepare('UPDATE skus SET stock=stock+? WHERE id=?').run(item.qty,item.sku_id);db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(item.product_id);db.prepare('UPDATE return_requests SET restocked=1 WHERE id=?').run(r.id);audit(db,user,'inventory_return',item.sku_id,{qty:item.qty,returnId:r.id});}}
        else if(d.action==='refunded'&&admin&&r.status==='Chờ hoàn tiền'){const reference=text(d.reference,'Chứng từ hoàn tiền',200);status='Đã hoàn tiền';db.prepare('UPDATE return_requests SET refund_reference=? WHERE id=?').run(reference,r.id);}
        else fail(409,'Không có quyền hoặc trạng thái không phù hợp.');
        db.prepare('UPDATE return_requests SET status=? WHERE id=?').run(status,r.id);db.prepare('INSERT INTO return_history(return_id,actor_id,status,note) VALUES(?,?,?,?)').run(r.id,user.id,status,d.reason||d.reference||'');notify(r.buyer_id,`Yêu cầu ${r.id}: ${status}`,'return/'+r.id);audit(db,user,'return_'+d.action,r.id,{status,reason:d.reason||'',reference:d.reference||''});});json({ok:true});return true;
    }
    return false;
  }
  return {snapshot,handle,quote,readOrders,notify};
}
