import {openDatabase} from '../server/database.mjs';
import {createMarketServer} from '../server/http.mjs';
const port=Number(process.env.PORT||4173),host='127.0.0.1';
const origin=process.env.APP_ORIGIN||`http://${host}:${port}`;
if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw Error('Production cần APP_ORIGIN dùng HTTPS.');
const db=openDatabase(process.env.DB_PATH||'data/market.sqlite');
const server=createMarketServer(db,{origin,secure:origin.startsWith('https://'),development:process.env.NODE_ENV!=='production'});
server.listen(port,host,()=>console.log(`Chợ PTIT + API: ${origin}`));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>{db.close();process.exit(0);}));
