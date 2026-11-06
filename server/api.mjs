import {createCommerce} from './commerce.mjs';
import {randomUUID} from 'node:crypto';
import {audit,transaction} from './database.mjs';
import {HttpError,text,integer,email,password,hashPassword,verifyPassword,token,digest,rateLimit,validatePhoto} from './security.mjs';

const publicUser=u=>u?{id:u.id,email:u.email,name:u.name,phone:u.phone,role:u.role}:null;
const fail=(code,message)=>{throw new HttpError(code,message);};
const uid=prefix=>prefix+randomUUID();

export function createApi(db,{origin,secure=false,development=true}={}){
  let dummyHash;
  const commerce=createCommerce(db);
  const userById=id=>db.prepare('SELECT * FROM users WHERE id=?').get(id);
  const addresses=user=>user?db.prepare('SELECT id,name,phone,street,is_default AS "default" FROM addresses WHERE user_id=? ORDER BY is_default DESC,rowid').all(user.id).map(x=>({...x,default:!!x.default})):[];
  const myShops=user=>user?db.prepare('SELECT id FROM shops WHERE owner_id=?').all(user.id).map(x=>x.id):[];
  function products(user){
    const rows=db.prepare(`SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE (p.visible=1 AND p.moderation='approved' AND s.status='Đang hoạt động') OR ?='admin' OR s.owner_id=?`).all(user?.role||'',user?.id||'');
    return rows.map(p=>{const review=db.prepare('SELECT COUNT(*) count,AVG(rating) rating FROM reviews WHERE product_id=?').get(p.id);const skus=db.prepare('SELECT * FROM skus WHERE product_id=? ORDER BY rowid').all(p.id);return {rating:review.rating,reviewCount:review.count,id:p.id,shopId:p.shop_id,name:p.name,category:p.category,description:p.description,attributes:p.attributes,brand:p.brand,image:p.image,photo:p.photo,visible:!!p.visible,moderation:p.moderation,reason:p.reason,version:p.version,skus:skus.map(x=>({id:x.id,label:x.label,code:x.code,price:x.price,stock:x.stock,weight:x.weight})),price:Math.min(...skus.map(x=>x.price)),maxPrice:Math.max(...skus.map(x=>x.price)),stock:skus.reduce((n,x)=>n+x.stock,0),variants:skus.map(x=>x.label).join(', '),sku:skus[0]?.code,weight:skus[0]?.weight||350};});
  }
  function bootstrap(user,session){const owned=myShops(user);const shops=db.prepare(`SELECT id,name,category,status,shipping,rating,description,CASE WHEN owner_id=? OR ?='admin' THEN pickup ELSE '' END pickup,CASE WHEN owner_id=? OR ?='admin' THEN bank ELSE '' END bank FROM shops WHERE status='Đang hoạt động' OR owner_id=? OR ?='admin'`).all(user?.id||'',user?.role||'',user?.id||'',user?.role||'',user?.id||'',user?.role||'');return {user:publicUser(user),profile:user?{name:user.name,email:user.email,phone:user.phone}:{name:'',email:'',phone:''},csrf:session?.csrf||null,shops:shops.map(s=>({...s,rating:db.prepare('SELECT AVG(r.rating) rating FROM reviews r JOIN products p ON p.id=r.product_id WHERE p.shop_id=?').get(s.id).rating})),shopIds:owned,shopId:owned.find(id=>shops.some(s=>s.id===id&&s.status==='Đang hoạt động'))||owned[0]||null,products:products(user),categories:db.prepare('SELECT name FROM categories ORDER BY rowid').all().map(x=>x.name),addresses:addresses(user),applications:user?db.prepare(`SELECT id,user_id AS userId,name,owner,category,legal_name AS legalName,bank,status,reason FROM applications WHERE user_id=? OR ?='admin'`).all(user.id,user.role):[],users:user?.role==='admin'?db.prepare('SELECT id,email,name,role FROM users').all():[],backend:true,emailEnabled:false,...commerce.snapshot(user)};}
  function sessionFor(req){const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('nep_session='))?.slice(12);if(!cookie||!/^[a-f0-9]{64}$/.test(cookie))return null;return db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(cookie),Date.now());}
  function setCookie(res,value,ttl){res.setHeader('Set-Cookie',`nep_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure?'; Secure':''}`);}
  function createSession(res,user){db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());const raw=token(),csrf=token(),expires=Date.now()+7*86400000;db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw),user.id,csrf,expires);setCookie(res,raw,7*86400);return {csrf};}
  function requireUser(user,role){if(!user)fail(401,'Vui lòng đăng nhập.');if(role&&user.role!==role)fail(403,'Bạn không có quyền thực hiện thao tác này.');}
  function requireShop(user,id){requireUser(user,'seller');const s=db.prepare('SELECT * FROM shops WHERE id=?').get(id);if(!s||s.owner_id!==user.id)fail(403,'Bạn không sở hữu gian hàng này.');if(s.status!=='Đang hoạt động')fail(403,'Gian hàng chưa được duyệt hoặc đã bị khóa.');return s;}
  function category(value){const c=text(value,'Ngành hàng');if(!db.prepare('SELECT 1 FROM categories WHERE name=?').get(c))fail(400,'Ngành hàng không tồn tại.');return c;}
  async function readBody(req){if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Yêu cầu JSON.');let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024)fail(413,'Dữ liệu gửi quá lớn.');chunks.push(chunk);}try{const v=JSON.parse(Buffer.concat(chunks).toString());if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch{fail(400,'JSON không hợp lệ.');}}
  return async function api(req,res){
    const url=new URL(req.url,origin||'http://localhost');const route=url.pathname;const method=req.method;
    if(!route.startsWith('/api/'))return false;
    const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try{
      const session=sessionFor(req),user=session?userById(session.user_id):null;
      if(method==='GET'&&route==='/api/health'){json({ok:true,database:db.prepare('SELECT 1 AS ok').get().ok===1});return true;}
      if(method==='GET'&&route==='/api/bootstrap'){json(bootstrap(user,session));return true;}
      if(method==='GET'&&route==='/api/catalog'){
        const q=(url.searchParams.get('q')||'').toLowerCase(),c=url.searchParams.get('category')||'',min=Number(url.searchParams.get('min')||0),max=Number(url.searchParams.get('max')||1000000000),page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1)),limit=20;
        if(!Number.isInteger(page)||!Number.isFinite(min)||!Number.isFinite(max)||min<0||max<min)fail(400,'Bộ lọc giá hoặc số trang không hợp lệ.');
        let rows=products(null).filter(p=>(!q||(p.name+' '+(db.prepare('SELECT name FROM shops WHERE id=?').get(p.shopId)?.name||'')).toLowerCase().includes(q))&&(!c||p.category===c)&&p.skus.some(x=>x.price>=min&&x.price<=max));
        const sort=url.searchParams.get('sort');if(sort==='asc')rows.sort((a,b)=>a.price-b.price);if(sort==='desc')rows.sort((a,b)=>b.price-a.price);json({items:rows.slice((page-1)*limit,page*limit),total:rows.length,page,limit});return true;
      }
      if(method==='GET'&&route==='/api/me'){requireUser(user);json({user:publicUser(user),csrf:session.csrf});return true;}
      if(!['POST','PUT','PATCH','DELETE'].includes(method))fail(404,'Không tìm thấy API.');
      const expected=origin||`http://${req.headers.host}`;
      if(req.headers.origin!==expected)fail(403,'Nguồn yêu cầu không hợp lệ.');
      if(session&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Phiên biểu mẫu không hợp lệ. Vui lòng tải lại trang.');
      const d=await readBody(req);
      if(method==='POST'&&['/api/auth/register','/api/auth/login','/api/auth/forgot','/api/auth/reset'].includes(route)){
        const ip=req.socket.remoteAddress||'local';rateLimit(db,'auth-ip:'+ip,30);
        if(route==='/api/auth/register'){
          const addr=email(d.email),name=text(d.name,'Họ tên',120),pass=password(d.password);rateLimit(db,'register:'+ip,8);
          if(db.prepare('SELECT 1 FROM users WHERE email=?').get(addr))fail(409,'Email đã được sử dụng.');
          const hash=await hashPassword(pass),id=uid('U');db.prepare('INSERT INTO users(id,email,name,password_hash) VALUES(?,?,?,?)').run(id,addr,name,hash);
          const u=userById(id);audit(db,u,'register',id);json(bootstrap(u,createSession(res,u)),201);return true;
        }
        if(route==='/api/auth/login'){
          const addr=email(d.email),pass=password(d.password);rateLimit(db,'login:'+addr,10);const u=db.prepare('SELECT * FROM users WHERE email=?').get(addr);
          dummyHash||=await hashPassword('unavailable-user-placeholder');const valid=await verifyPassword(pass,u?.password_hash||dummyHash);if(!u||!valid||userById(u.id)?.password_hash!==u.password_hash)fail(401,'Email hoặc mật khẩu không đúng.');
          if(session)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);audit(db,u,'login',u.id);json(bootstrap(u,createSession(res,u)));return true;
        }
        if(route==='/api/auth/forgot'){fail(503,'Khôi phục qua email chưa được cấu hình. Vui lòng liên hệ quản trị viên.');}
        const raw=text(d.token,'Mã khôi phục',64),pass=password(d.password),hash=await hashPassword(pass);
        transaction(db,()=>{const r=db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND expires_at>? AND used=0').get(digest(raw),Date.now());if(!r)fail(400,'Liên kết hết hạn hoặc đã được sử dụng.');db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,r.user_id);db.prepare('UPDATE password_resets SET used=1 WHERE token_hash=?').run(digest(raw));db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id);audit(db,{id:r.user_id},'password_reset',r.user_id);});setCookie(res,'',0);json({message:'Đã đặt lại mật khẩu. Vui lòng đăng nhập.'});return true;
      }
      requireUser(user);
      if(await commerce.handle({route,method,user,d,req,json}))return true;
      if(method==='POST'&&route==='/api/auth/logout'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);setCookie(res,'',0);json({ok:true});return true;}
      if(method==='PATCH'&&route==='/api/me'){
        const name=text(d.name,'Họ tên',120),phone=text(d.phone||'','Số điện thoại',30,false),addr=email(d.email);db.prepare('UPDATE users SET name=?,phone=?,email=? WHERE id=?').run(name,phone,addr,user.id);audit(db,user,'profile_update',user.id);json({ok:true});return true;
      }
      if(method==='POST'&&route==='/api/auth/password'){
        rateLimit(db,'password:'+user.id,5);password(d.currentPassword);const oldHash=user.password_hash;if(!await verifyPassword(d.currentPassword,oldHash))fail(401,'Mật khẩu hiện tại không đúng.');const hash=await hashPassword(password(d.password));
        transaction(db,()=>{const changed=db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').run(hash,user.id,oldHash);if(!changed.changes)fail(409,'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.');db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);audit(db,user,'password_change',user.id);});setCookie(res,'',0);json({ok:true});return true;
      }
      if(route.startsWith('/api/addresses')){
        const id=route.split('/')[3];if(method==='POST'&&route==='/api/addresses'){
          const values=[text(d.name,'Người nhận',120),text(d.phone,'Số điện thoại',30),text(d.street,'Địa chỉ',500)];transaction(db,()=>{const count=db.prepare('SELECT COUNT(*) n FROM addresses WHERE user_id=?').get(user.id).n;if(count>=20)fail(400,'Tối đa 20 địa chỉ.');db.prepare('INSERT INTO addresses VALUES(?,?,?,?,?,?)').run(uid('A'),user.id,...values,count===0?1:0);});
        }else{
          if(!db.prepare('SELECT 1 FROM addresses WHERE id=? AND user_id=?').get(id,user.id))fail(404,'Không tìm thấy địa chỉ.');
          transaction(db,()=>{if(method==='DELETE'){db.prepare('DELETE FROM addresses WHERE id=?').run(id);if(!db.prepare('SELECT 1 FROM addresses WHERE user_id=? AND is_default=1').get(user.id))db.prepare('UPDATE addresses SET is_default=1 WHERE id=(SELECT id FROM addresses WHERE user_id=? LIMIT 1)').run(user.id);}else if(method==='PATCH'&&d.default===true){db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(user.id);db.prepare('UPDATE addresses SET is_default=1 WHERE id=?').run(id);}else if(method==='PUT'){db.prepare('UPDATE addresses SET name=?,phone=?,street=? WHERE id=?').run(text(d.name,'Người nhận',120),text(d.phone,'Số điện thoại',30),text(d.street,'Địa chỉ',500),id);}else fail(405,'Thao tác không hỗ trợ.');});
        }json({addresses:addresses(user)});return true;
      }
      if(method==='POST'&&route==='/api/applications'){
        const name=text(d.name,'Tên gian hàng',120),owner=text(d.owner,'Chủ sở hữu',120),c=category(d.category),legal=text(d.legalName,'Tên pháp lý',120),bank=text(d.bank,'Thông tin ngân hàng',300),id=uid('SH');
        if(d.id){transaction(db,()=>{const previous=db.prepare('SELECT * FROM applications WHERE id=? AND user_id=?').get(d.id,user.id);if(!previous||previous.status!=='Cần bổ sung')fail(409,'Hồ sơ không ở trạng thái cần bổ sung.');db.prepare("UPDATE applications SET name=?,owner=?,category=?,legal_name=?,bank=?,status='Chờ duyệt',reason='' WHERE id=?").run(name,owner,c,legal,bank,d.id);db.prepare("UPDATE shops SET name=?,category=?,bank=?,status='Chờ duyệt' WHERE id=?").run(name,c,bank,previous.shop_id);audit(db,user,'shop_resubmit',d.id);for(const admin of db.prepare("SELECT id FROM users WHERE role='admin'").all())commerce.notify(admin.id,`Gian hàng ${name} đã bổ sung hồ sơ`,'admin/approvals');});json({id:d.id});return true;}
        transaction(db,()=>{if(db.prepare("SELECT 1 FROM applications WHERE user_id=? AND status='Chờ duyệt'").get(user.id))fail(409,'Bạn đã có hồ sơ chờ duyệt.');db.prepare("INSERT INTO shops(id,owner_id,name,category,status,bank) VALUES(?,?,?,?,'Chờ duyệt',?)").run(id,user.id,name,c,bank);db.prepare('INSERT INTO applications(id,user_id,shop_id,name,owner,category,legal_name,bank) VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,id,name,owner,c,legal,bank);audit(db,user,'shop_apply',id);for(const admin of db.prepare("SELECT id FROM users WHERE role='admin'").all())commerce.notify(admin.id,`Có hồ sơ gian hàng mới: ${name}`,'admin/approvals');});json({id},201);return true;
      }
      if(route.startsWith('/api/admin/')){
        requireUser(user,'admin');const parts=route.split('/'),kind=parts[3],id=parts[4];
        if(method==='PATCH'&&kind==='shops'){
          if(!['Đang hoạt động','Đã khóa'].includes(d.status))fail(400,'Trạng thái không hợp lệ.');const reason=text(d.reason||'','Lý do',1000,d.status==='Đã khóa');const current=db.prepare('SELECT * FROM shops WHERE id=?').get(id);if(!current||!['Đang hoạt động','Đã khóa'].includes(current.status))fail(409,'Chỉ khóa/mở gian hàng đã được duyệt.');transaction(db,()=>{db.prepare('UPDATE shops SET status=? WHERE id=?').run(d.status,id);audit(db,user,'shop_status',id,{status:d.status,reason});commerce.notify(current.owner_id,`Gian hàng ${current.name}: ${d.status}. ${reason}`,'seller');});json({ok:true});return true;
        }
        if(kind==='categories'&&id&&['PUT','DELETE'].includes(method)){
          const old=decodeURIComponent(id);if(!db.prepare('SELECT 1 FROM categories WHERE name=?').get(old))fail(404,'Không tìm thấy ngành hàng.');
          transaction(db,()=>{if(method==='PUT'){const name=text(d.name,'Ngành hàng',120);if(name!==old){db.prepare('INSERT INTO categories VALUES(?)').run(name);db.prepare('UPDATE products SET category=? WHERE category=?').run(name,old);db.prepare('UPDATE shops SET category=? WHERE category=?').run(name,old);db.prepare('UPDATE applications SET category=? WHERE category=?').run(name,old);db.prepare('DELETE FROM categories WHERE name=?').run(old);}audit(db,user,'category_rename',old,{name});}else{if(db.prepare('SELECT 1 FROM products WHERE category=?').get(old)||db.prepare('SELECT 1 FROM shops WHERE category=?').get(old))fail(409,'Ngành hàng đang được sử dụng.');db.prepare('DELETE FROM categories WHERE name=?').run(old);audit(db,user,'category_delete',old);}});json({ok:true});return true;
        }
        if(method==='PATCH'&&kind==='applications'){
          if(!['approve','reject'].includes(d.decision))fail(400,'Quyết định không hợp lệ.');const a=db.prepare('SELECT * FROM applications WHERE id=?').get(id);if(!a)fail(404,'Không tìm thấy hồ sơ.');if(a.status!=='Chờ duyệt')fail(409,'Hồ sơ đã được xử lý.');const approved=d.decision==='approve',reason=approved?'':text(d.reason,'Lý do bổ sung',1000);
          transaction(db,()=>{db.prepare('UPDATE applications SET status=?,reason=? WHERE id=?').run(approved?'Đã duyệt':'Cần bổ sung',reason,id);db.prepare('UPDATE shops SET status=? WHERE id=?').run(approved?'Đang hoạt động':'Cần bổ sung',a.shop_id);if(approved)db.prepare("UPDATE users SET role='seller' WHERE id=? AND role='buyer'").run(a.user_id);audit(db,user,'shop_'+d.decision,id,{reason});commerce.notify(a.user_id,`Hồ sơ ${a.name}: ${approved?'Đã duyệt':'Cần bổ sung'}. ${reason}`,'shop-pending');});json({ok:true});return true;
        }
        if(method==='PATCH'&&kind==='products'){
          if(!['approved','rejected'].includes(d.moderation))fail(400,'Trạng thái không hợp lệ.');const reason=d.moderation==='rejected'?text(d.reason,'Lý do gỡ',1000):'';const result=db.prepare('UPDATE products SET moderation=?,reason=?,version=version+1 WHERE id=?').run(d.moderation,reason,id);if(!result.changes)fail(404,'Không tìm thấy sản phẩm.');audit(db,user,'product_moderate',id,{moderation:d.moderation,reason});json({ok:true});return true;
        }
        if(method==='POST'&&kind==='categories'){const name=text(d.name,'Tên ngành hàng',120);db.prepare('INSERT INTO categories VALUES(?)').run(name);audit(db,user,'category_create',name);json({ok:true},201);return true;}
        fail(404,'Không tìm thấy API quản trị.');
      }
      if(route.startsWith('/api/seller/shops/')){
        const parts=route.split('/'),shopId=parts[4],kind=parts[5],id=parts[6],own=requireShop(user,shopId);
        if(method==='PATCH'&&!kind){const name=d.name===undefined?own.name:text(d.name,'Tên gian hàng',120),shipping=d.shipping===undefined?own.shipping:integer(d.shipping,'Phí giao hàng',0,10000000);const bank=d.bank===undefined?own.bank:text(d.bank,'Ngân hàng',300,false),pickup=d.pickup===undefined?own.pickup:text(d.pickup,'Địa chỉ lấy hàng',500,false),description=d.description===undefined?own.description:text(d.description,'Giới thiệu',3000,false);db.prepare('UPDATE shops SET name=?,shipping=?,bank=?,pickup=?,description=? WHERE id=?').run(name,shipping,bank,pickup,description,shopId);audit(db,user,'shop_update',shopId);json({ok:true});return true;}
        if(method==='PUT'&&kind==='inventory'){
          if(!Array.isArray(d.skus)||!d.skus.length||d.skus.length>200)fail(400,'Danh sách tồn kho không hợp lệ.');
          transaction(db,()=>{const seen=new Set();for(const x of d.skus){if(seen.has(x.id))fail(400,'SKU trùng lặp.');seen.add(x.id);integer(x.stock,'Tồn kho',0,1000000);const row=db.prepare('SELECT s.*,p.shop_id FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=?').get(x.id);if(!row||row.shop_id!==shopId)fail(403,'SKU thuộc gian hàng khác.');if(row.stock!==x.previousStock)fail(409,'Tồn kho đã thay đổi. Vui lòng tải lại.');db.prepare('UPDATE skus SET stock=? WHERE id=?').run(x.stock,x.id);db.prepare('UPDATE products SET version=version+1 WHERE id=?').run(row.product_id);audit(db,user,'inventory_adjust',x.id,{before:row.stock,after:x.stock});}});json({ok:true});return true;
        }
        if(kind==='products'){
          const old=id?db.prepare('SELECT * FROM products WHERE id=?').get(id):null;
          if(id&&(!old||old.shop_id!==shopId))fail(403,'Sản phẩm thuộc gian hàng khác.');
          if(method==='DELETE'&&id){db.prepare('UPDATE products SET visible=0,version=version+1 WHERE id=?').run(id);audit(db,user,'product_archive',id);json({ok:true});return true;}
          if((method==='POST'&&!id)||(method==='PUT'&&id)){
            const name=text(d.name,'Tên sản phẩm',200),c=category(d.category),description=text(d.description||'','Mô tả',10000,false),attributes=text(d.attributes||'','Thuộc tính',3000,false),brand=text(d.brand||'','Thương hiệu',200,false),photo=d.photo===undefined?old?.photo||null:validatePhoto(d.photo);
            if(!Array.isArray(d.skus)||!d.skus.length||d.skus.length>50)fail(400,'Cần từ 1 đến 50 SKU.');
            const seen=new Set(),skuData=d.skus.map(x=>{const label=text(x.label,'Phân loại',100),code=text(x.code,'Mã SKU',100);if(seen.has(label)||seen.has(code))fail(400,'SKU hoặc phân loại trùng nhau.');seen.add(label);seen.add(code);return {id:typeof x.id==='string'?x.id:uid('SKU'),label,code,price:integer(x.price,'Giá bán'),stock:integer(x.stock,'Tồn kho',0,1000000),weight:integer(x.weight??350,'Trọng lượng',0,1000000)};});
            const productId=id||uid('P');transaction(db,()=>{
              if(old&&old.version!==d.version)fail(409,'Sản phẩm đã thay đổi. Vui lòng tải lại.');
              if(old)db.prepare("UPDATE products SET name=?,category=?,description=?,attributes=?,brand=?,photo=?,visible=1,moderation='pending',reason='',version=version+1 WHERE id=?").run(name,c,description,attributes,brand,photo,productId);
              else db.prepare('INSERT INTO products(id,shop_id,name,category,description,attributes,brand,photo,image) VALUES(?,?,?,?,?,?,?,?,?)').run(productId,shopId,name,c,description,attributes,brand,photo,'product-placeholder');
              const previous=db.prepare('SELECT id FROM skus WHERE product_id=?').all(productId).map(x=>x.id);
              for(const x of skuData){if(db.prepare('SELECT 1 FROM skus WHERE id=? AND product_id<>?').get(x.id,productId))fail(403,'SKU thuộc sản phẩm khác.');db.prepare('INSERT INTO skus VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,code=excluded.code,price=excluded.price,stock=excluded.stock,weight=excluded.weight').run(x.id,productId,x.label,x.code,x.price,x.stock,x.weight);}
              for(const oldId of previous)if(!skuData.some(x=>x.id===oldId)){if(db.prepare('SELECT 1 FROM order_items WHERE sku_id=?').get(oldId))fail(409,'Không thể xóa SKU đã phát sinh đơn hàng.');db.prepare('DELETE FROM cart_items WHERE sku_id=?').run(oldId);db.prepare('DELETE FROM skus WHERE id=?').run(oldId);}
              audit(db,user,old?'product_update':'product_create',productId);
            });json({id:productId,moderation:'pending'},old?200:201);return true;
          }
        }
        fail(404,'Không tìm thấy API người bán.');
      }
      fail(404,'Không tìm thấy API.');
    }catch(err){if(err.status)json({error:err.message},err.status);else if(err.code?.startsWith('ERR_SQLITE')&&/UNIQUE/.test(err.message))json({error:'Dữ liệu đã tồn tại hoặc mã SKU bị trùng.'},409);else{console.error('API error:',err.name,err.code||'internal');json({error:'Không thể xử lý yêu cầu. Vui lòng thử lại.'},500);}}
    return true;
  };
}
