import {openDatabase} from '../../server/database.mjs';
import {createMarketServer} from '../../server/http.mjs';
import {seed} from '../fixtures/seed.mjs';
const db=openDatabase(':memory:');await seed(db);
db.prepare("UPDATE skus SET price=499000 WHERE id='oxford-1'").run();
const port=Number(process.env.UI_TEST_PORT||4174);
const server=createMarketServer(db,{origin:`http://127.0.0.1:${port}`,development:false});
server.listen(port,'127.0.0.1',()=>console.log(`Isolated UI test server: http://127.0.0.1:${port}`));
