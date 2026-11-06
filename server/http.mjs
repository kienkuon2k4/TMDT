import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createApi} from './api.mjs';
export function createMarketServer(db,{origin,secure=false,development=true,root=path.resolve('dist')}={}){
  const api=createApi(db,{origin,secure,development});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      if(await api(req,res))return;
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
    }catch(err){if(!res.headersSent)res.writeHead(err.code==='ENOENT'||err.code==='EISDIR'?404:500);res.end('Không tìm thấy tài nguyên.');}
  });
}
