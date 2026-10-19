import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerBoundPreviewReader} from '../supabase/functions/navi-discover/known-stores.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const center={latitude:32.74,longitude:129.88};
const row={store_id:'22222222-2222-4222-8222-222222222222',name:'餃子菜館 万徳',latitude:32.7401,longitude:129.88,used:false,revisited:false};
function fixture(){const calls=[];return {calls,database:{withConnection:async cb=>cb({query:async(sql,args)=>{calls.push({sql,args});return {rows:[row]};}})}};}
test('preview reader invokes three-argument owner-bound function, never sends owner UUID',async()=>{
 const {calls,database}=fixture();
 const result=await createOwnerBoundPreviewReader(database,owner)(center,500);
 assert.equal(result.length,1);
 assert.equal(result[0].haraken_usage,'unvisited');
 assert.match(calls[0].sql,/guest_known_stores_unvisited_preview\(/);
 assert.doesNotMatch(calls[0].sql,/\$4|owner_id/);
 assert.equal(calls[0].args.length,3);
 assert.deepEqual(calls[0].args.slice(0,2),[center.latitude,center.longitude]);
 assert.ok(calls[0].args[2]>=500);
 assert.ok(!calls[0].args.includes(owner));
});
test('preview reader rejects invalid GPS and invalid owner config without DB access',async()=>{
 const {calls,database}=fixture();
 assert.deepEqual(await createOwnerBoundPreviewReader(database,owner)({latitude:NaN,longitude:129.88},500),[]);
 assert.deepEqual(await createOwnerBoundPreviewReader(database,'invalid')(center,500),[]);
 assert.deepEqual(await createOwnerBoundPreviewReader(database,owner)(center,3001),[]);
 assert.equal(calls.length,0);
});
