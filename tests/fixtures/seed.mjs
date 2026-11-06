import {openDatabase,transaction} from '../../server/database.mjs';
import {hashPassword} from '../../server/security.mjs';
import {initialState} from '../../archive/frontend-prototype/market-store.js';

export async function seed(db,pass='NepDemo!2026'){
  if(db.prepare('SELECT COUNT(*) n FROM users').get().n)return false;
  const hash=await hashPassword(pass),s=initialState();
  transaction(db,()=>{
    for(const c of s.categories)db.prepare('INSERT INTO categories VALUES(?)').run(c);
    for(const [id,email,name,role] of [['buyer','buyer@nep.local','Nguyễn Minh Anh','buyer'],['seller','seller@nep.local','Kiên · K-Tech','seller'],['seller2','seller2@nep.local','Mộc Wear','seller'],['admin','admin@nep.local','Quản trị Nếp','admin']])db.prepare('INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,?,?)').run(id,email,name,hash,role);
    for(const x of s.shops)db.prepare('INSERT INTO shops(id,owner_id,name,category,status,shipping,rating) VALUES(?,?,?,?,?,?,?)').run(x.id,x.id==='kt'?'seller':'seller2',x.name,x.category,x.status,x.shipping,x.rating);
    for(const p of s.products){db.prepare("INSERT INTO products(id,shop_id,name,category,description,attributes,image,moderation) VALUES(?,?,?,?,?,?,?,'approved')").run(p.id,p.shopId,p.name,p.category,p.description,p.attributes,p.image);for(const [i,label] of p.variants.split(',').entries())db.prepare('INSERT INTO skus VALUES(?,?,?,?,?,?,?)').run(p.id+'-'+i,p.id,label.trim(),p.id.toUpperCase()+'-'+i,p.price,p.stock,350);}
    for(const a of s.addresses)db.prepare('INSERT INTO addresses VALUES(?,?,?,?,?,?)').run(a.id,'buyer',a.name,a.phone,a.street,1);
  });return true;
}
