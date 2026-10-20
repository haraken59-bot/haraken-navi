import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStoreSelection,confirmManualStore,photoPoint} from '../store-link-ui.js';
import {filterNearbyPhotoStores} from '../photo-store-candidates.js';
import {resolveMealStoreId} from '../meal-store-id.js';
const id='11111111-1111-4111-8111-111111111111',point={latitude:32.74,longitude:129.87};
test('external ID cannot become store UUID; uniquely registered location is reused',async()=>{
 let writes=0;const c={id:'hotpepper:X',name:'万徳',...point};const got=await resolveStoreSelection({stores:async()=>[{...c,id}],confirmStore:async()=>{writes++;}},c);assert.equal(got,id);assert.equal(writes,0);
});
test('same name at different location never registers automatically',async()=>{
 let writes=0;await assert.rejects(resolveStoreSelection({stores:async()=>[{id,name:'万徳',latitude:33,longitude:130}],confirmStore:async()=>writes++},{name:'万徳',...point}));assert.equal(writes,0);
});
test('account switch while reading stores prevents confirmation write',async()=>{
 let current=true,writes=0;await assert.rejects(resolveStoreSelection({stores:async()=>{current=false;return [];},confirmStore:async()=>writes++},{name:'万徳',...point},()=>current));assert.equal(writes,0);
});
test('confirmation cancel never writes',async()=>{let writes=0;assert.equal(await confirmManualStore({candidate:{name:'万徳',...point},approved:false,client:{confirmStore:async()=>writes++},onSelect:async()=>writes++}),false);assert.equal(writes,0);});
test('photo candidates deduplicate and preserve only registered UUIDs',()=>{const c={name:'万徳',...point,id:'hotpepper:X',store_id:id};const rows=filterNearbyPhotoStores([c,c],point,'万徳');assert.equal(rows.length,1);assert.equal(rows[0].store_id,id);assert.equal(rows[0].id,undefined);});
test('current GPS cannot substitute for missing photo GPS',()=>assert.equal(photoPoint({current_location:point}),null));
test('untrusted or empty store IDs cannot be saved',()=>assert.equal(resolveMealStoreId([{id:'hotpepper:X',name:'万徳'}],'hotpepper:X','万徳',null),null));
