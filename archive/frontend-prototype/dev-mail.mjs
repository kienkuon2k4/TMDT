import {openDatabase} from '../server/database.mjs';
if(process.env.NODE_ENV==='production')throw Error('Hộp thư này chỉ dùng ở môi trường phát triển.');
const db=openDatabase(process.env.DB_PATH||'data/market.sqlite');
for(const mail of db.prepare('SELECT email,message,created_at FROM dev_mail ORDER BY created_at DESC LIMIT 5').all())console.log(`${mail.created_at} → ${mail.email}\n${mail.message}\n`);
db.close();
