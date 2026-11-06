import {openDatabase} from '../server/database.mjs';
import {backupDatabase} from '../server/backup.mjs';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
const source=process.env.DB_PATH||'data/market.sqlite';if(!existsSync(source))throw Error('Không tìm thấy database cần sao lưu.');const db=openDatabase(source);
try{const stamp=new Date().toISOString().replace(/[:.]/g,'-');const target=process.env.BACKUP_PATH||`data/backups/cho-ptit-${stamp}-${randomUUID().slice(0,8)}.sqlite`;console.log('Đã sao lưu database:',backupDatabase(db,target));}finally{db.close();}
