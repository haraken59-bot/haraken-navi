import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnownStoreReader,mergeKnownStores} from '../supabase/functions/navi-discover/known-stores.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const center={latitude:32.7400,longitude:129.8800};
const row=(id,name,used,revisited=false,lat=32.7401)=>({store_id:id,name,latitude:lat,longitude:129.8800,used,revisited});
const a='22222222-2222-4222-8222-222222222222';
const b='33333333-3333-4333-8333-333333333333';
const c='44444444-4444-4444-8444-444444444444';
function reader(rows){return createKnownStoreReader({withConnection:async fn=>fn({query:async()=>({rows})})},owner);}
test('unvisited and visited stores are distinguished',async()=>{
 const found=await reader([row(a,'餃子菜館 万徳',false),row(b,'訪問済',true),row(c,'再訪',true,true)])(center,500);
 assert.deepEqual(found.map(x=>x.haraken_usage),['unvisited','used','revisited']);
 assert.equal(found[0].source_kind,'known_store');
});
test('invalid locations and store IDs are excluded',async()=>{
 const found=await reader([row(a,'有効',false),row('invalid','無効',false),row(b,'遠方',false,false,33.5)])(center,500);
 assert.equal(found.length,1);
});
test('exact nearby external match is merged rather than duplicated',async()=>{
 const known=await reader([row(a,'餃子菜館 万徳',false)])(center,500);
 const merged=mergeKnownStores([{id:'external:1',name:'餃子菜館 万徳',latitude:32.7401,longitude:129.8800}],known);
 assert.equal(merged.length,1);
 assert.equal(merged[0].haraken_usage,'unvisited');
});
test('different names do not merge',async()=>{
 const known=await reader([row(a,'餃子菜館 万徳',false)])(center,500);
 const merged=mergeKnownStores([{id:'external:1',name:'別の店',latitude:32.7401,longitude:129.8800}],known);
 assert.equal(merged.length,2);
});
