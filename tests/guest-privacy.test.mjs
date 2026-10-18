import assert from 'node:assert/strict';
import test from 'node:test';
import {createHandler} from '../supabase/functions/navi-discover/handler.mjs';

test('guest search never reads or returns private owner store data',async()=>{
 let usageCalls=0,knownCalls=0;
 const handler=createHandler({
  ownerId:'11111111-1111-4111-8111-111111111111',
  verifyUser:async()=>{throw Error('guest must not authenticate');},
  guestDiscover:async()=>({
   radius_m:500,center:{latitude:33.59,longitude:130.4},
   candidates:[{id:'hotpepper:J0001',name:'Public restaurant',latitude:33.59,longitude:130.4,source_kind:'hotpepper',discovered:true,store_id:'private-store',haraken_usage:'used',visited:true},
    {id:'known:private',name:'Private registered restaurant',latitude:33.59,longitude:130.4,source_kind:'known_store',discovered:true,store_id:'private-store'}],
  }),
  usage:async()=>{usageCalls++;return [{id:'hotpepper:J0001',used:true}];},
  knownStores:async()=>{knownCalls++;return [{id:'known:private',name:'Private registered restaurant'}];},
 });
 const response=await handler(new Request('https://example.test/functions/v1/navi-discover?mode=guest-discover&latitude=33.59&longitude=130.4'));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(usageCalls,0);
 assert.equal(knownCalls,0);
 assert.equal(data.candidates.length,1);
 const row=data.candidates[0];
 assert.equal(row.name,'Public restaurant');
 assert.equal(row.store_id,undefined);
 assert.equal(row.haraken_usage,undefined);
 assert.equal(row.visited,false);
 assert.equal(JSON.stringify(data).includes('Private registered restaurant'),false);
});
