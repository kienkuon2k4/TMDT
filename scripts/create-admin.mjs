import {openDatabase,transaction,audit} from '../server/database.mjs';
import {email,password,text,hashPassword} from '../server/security.mjs';
import {randomUUID} from 'node:crypto';
const address=email(process.env.ADMIN_EMAIL),pass=password(process.env.ADMIN_PASSWORD),name=text(process.env.ADMIN_NAME||'Quản trị Chợ PTIT','Họ tên',120);
const db=openDatabase(process.env.DB_PATH||'data/market.sqlite');
try{if(db.prepare('SELECT 1 FROM users WHERE email=?').get(address))throw Error('Email đã tồn tại. Lệnh này không thay đổi quyền hoặc mật khẩu tài khoản có sẵn.');const hash=await hashPassword(pass),id=randomUUID();transaction(db,()=>{db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,?,'admin')").run(id,address,name,hash);audit(db,{id},'admin_provision',id);});console.log('Đã tạo tài khoản quản trị. Đăng nhập bằng thông tin bạn vừa cấu hình.');}finally{db.close();}
