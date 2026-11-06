import path from 'node:path';
import {mkdirSync,existsSync} from 'node:fs';
export function backupDatabase(db,filename){const destination=path.resolve(filename);if(existsSync(destination))throw Error('Tệp đích đã tồn tại. Hãy chọn tên khác.');mkdirSync(path.dirname(destination),{recursive:true});db.prepare('VACUUM INTO ?').run(destination);return destination;}
