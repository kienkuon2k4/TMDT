import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('hex');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function text(value,label,max=200,required=true){if(typeof value!=='string'||(required&&!value.trim())||value.length>max)throw new HttpError(400,`${label} không hợp lệ.`);return value.trim();}
export function integer(value,label,min=0,max=1000000000){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new HttpError(400,`${label} không hợp lệ.`);return value;}
export function email(value){value=text(value,'Email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new HttpError(400,'Email không hợp lệ.');return value;}
export function password(value){if(typeof value!=='string'||value.length<8||value.length>128)throw new HttpError(400,'Mật khẩu cần từ 8 đến 128 ký tự.');return value;}
export async function hashPassword(value){const salt=randomBytes(16).toString('hex');const key=await derive(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(value,stored){const [,salt,expected]=stored.split(':');const key=await derive(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(key,Buffer.from(expected,'hex'));}
export function rateLimit(db,key,limit=10,now=Date.now()){db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(now);const x=db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key);if(x&&x.count>=limit)throw new HttpError(429,'Thử quá nhiều lần. Vui lòng thử lại sau 15 phút.');db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+15*60*1000);}
export function validatePhoto(value){if(value===undefined||value===null)return null;if(typeof value!=='string'||value.length>2800000)throw new HttpError(400,'Ảnh quá lớn (tối đa 2 MB).');const match=value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw new HttpError(400,'Chỉ hỗ trợ ảnh PNG/JPEG.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024||bytes.length<12)throw new HttpError(400,'Ảnh không hợp lệ.');const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid)throw new HttpError(400,'Nội dung tệp không phải PNG/JPEG.');return value;}
