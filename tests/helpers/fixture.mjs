import assert from 'node:assert/strict';
import {openDatabase} from '../../server/database.mjs';
import {createMarketServer} from '../../server/http.mjs';
import {seed} from '../fixtures/seed.mjs';
export async function fixture(t){
  const db=openDatabase(':memory:');await seed(db);const server=createMarketServer(db);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
  function client(){let cookie='',csrf=null;return {get cookie(){return cookie;},async request(route,method='GET',body,headers={}){const response=await fetch(base+'/api'+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:base,'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const data=await response.json();if(Object.hasOwn(data,'csrf'))csrf=data.csrf;return {status:response.status,data,headers:response.headers};},async login(email='buyer@nep.local'){const r=await this.request('/auth/login','POST',{email,password:'NepDemo!2026'});assert.equal(r.status,200);return r;}};}
  return {db,base,client};
}
