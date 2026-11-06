import {migrateCommerce} from './commerce-schema.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

export function openDatabase(filename='data/market.sqlite') {
  if(filename!==':memory:')mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename,{timeout:5000});
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL COLLATE NOCASE,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'buyer' CHECK(role IN ('buyer','seller','admin')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories(name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS shops(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,category TEXT NOT NULL REFERENCES categories(name),status TEXT NOT NULL CHECK(status IN ('Đang hoạt động','Chờ duyệt','Cần bổ sung','Đã khóa')),shipping INTEGER NOT NULL DEFAULT 30000 CHECK(shipping>=0),rating TEXT NOT NULL DEFAULT 'Mới',description TEXT NOT NULL DEFAULT '',pickup TEXT NOT NULL DEFAULT '',bank TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),shop_id TEXT NOT NULL REFERENCES shops(id),name TEXT NOT NULL,owner TEXT NOT NULL,category TEXT NOT NULL,legal_name TEXT NOT NULL,bank TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Chờ duyệt',reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_application ON applications(user_id) WHERE status='Chờ duyệt';
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,shop_id TEXT NOT NULL REFERENCES shops(id),name TEXT NOT NULL,category TEXT NOT NULL REFERENCES categories(name),description TEXT NOT NULL DEFAULT '',attributes TEXT NOT NULL DEFAULT '',brand TEXT NOT NULL DEFAULT '',image TEXT NOT NULL DEFAULT 'market-0',photo TEXT,visible INTEGER NOT NULL DEFAULT 1,moderation TEXT NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')),reason TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS skus(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),label TEXT NOT NULL,code TEXT UNIQUE NOT NULL,price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),weight INTEGER NOT NULL DEFAULT 350 CHECK(weight>=0),UNIQUE(product_id,label));
    CREATE TABLE IF NOT EXISTS addresses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,phone TEXT NOT NULL,street TEXT NOT NULL,is_default INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS one_default_address ON addresses(user_id) WHERE is_default=1;
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES users(id),action TEXT NOT NULL,target_id TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS dev_mail(id TEXT PRIMARY KEY,email TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT OR IGNORE INTO migrations VALUES(1,CURRENT_TIMESTAMP);
  `);
  migrateCommerce(db);
  return db;
}

export function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(err){db.exec('ROLLBACK');throw err;}}
export function audit(db,user,action,target,details={}){db.prepare('INSERT INTO audit(user_id,action,target_id,details) VALUES(?,?,?,?)').run(user?.id||null,action,target,JSON.stringify(details));}
