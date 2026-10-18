import assert from 'node:assert/strict';
import test from 'node:test';
import {mergeKnownStores} from '../supabase/functions/navi-discover/known-stores.mjs';
const id='11111111-1111-4111-8111-111111111111';
const base={name:'同名店舗',latitude:33.59,longitude:130.4};
test('same name 20m apart is not automatically merged',()=>{
 const external=[{...base,id:'hotpepper:J001'}];
 const known=[{...base,latitude:33.59018,id:'known:'+id,store_id:id,haraken_usage:'used'}];
 const result=mergeKnownStores(external,known);
 assert.equal(result.length,2);
 assert.equal(result[0].store_id,undefined);
});
test('same coordinates with unique match can reuse store id',()=>{
 const external=[{...base,id:'hotpepper:J001'}];
 const known=[{...base,id:'known:'+id,store_id:id,haraken_usage:'used'}];
 const result=mergeKnownStores(external,known);
 assert.equal(result.length,1);assert.equal(result[0].store_id,id);
});
test('ambiguous identical candidates are never auto-linked',()=>{
 const external=[{...base,id:'hotpepper:J001'},{...base,id:'hotpepper:J002'}];
 const known=[{...base,id:'known:'+id,store_id:id,haraken_usage:'used'}];
 const result=mergeKnownStores(external,known);
 assert.equal(result.every(r=>r.store_id===undefined),true);
});
