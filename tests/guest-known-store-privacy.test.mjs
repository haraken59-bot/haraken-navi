import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/navi-discover/handler.mjs';

test('guest GPS search never queries private known stores or usage history',async()=>{
 let privateReads=0;
 const center={latitude:32.74,longitude:129.88};
 const handler=createHandler({
  ownerId:'11111111-1111-4111-8111-111111111111',
  knownStores:async()=>{privateReads++;throw Error('private store access');},
  usage:async()=>{privateReads++;throw Error('private usage access');},
  guestDiscover:async()=>({
   center,radius_m:500,needs_choice:false,
   candidates:[{id:'hp:1',name:'公開店舗',latitude:32.74,longitude:129.88,
    source_kind:'hotpepper',discovered:true,haraken_usage:'used'}]
  }),
  discover:async()=>{throw Error('member route not allowed');},
  verifyUser:async()=>null,
  database:{withConnection:async()=>{throw Error('private DB access');}},
 });
 const res=await handler(new Request('https://example.test/?mode=guest-discover&latitude=32.74&longitude=129.88'));
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(privateReads,0);
 assert.equal(body.candidates.length,1);
 assert.equal(body.candidates[0].name,'公開店舗');
 assert.equal(Object.hasOwn(body.candidates[0],'haraken_usage'),false);
 assert.equal(Object.hasOwn(body.candidates[0],'store_id'),false);
});
