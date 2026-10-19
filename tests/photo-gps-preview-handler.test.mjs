import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoPreviewHandler} from '../supabase/functions/navi-discover-photo-preview/preview-handler.mjs';
const owner='11111111-1111-4111-8111-111111111111';
function setup(userId=owner){
 let db=0,discover=0;
 const handler=createPhotoPreviewHandler({
  ownerId:owner,
  verifyUser:async()=>userId?{user_id:userId}:null,
  database:{withConnection:async()=>{db++;throw Error('DB must not be accessed');}},
  discover:async()=>{discover++;return {candidates:[]};}
 });
 return {handler,counts:()=>({db,discover})};
}
const req=(mode,authorization)=>new Request('https://example.test/?mode='+mode,authorization?{headers:{authorization:'Bearer aaa.bbb.ccc'}}:{});
test('guest discovery denied even without authorization',async()=>{
 const x=setup();assert.equal((await x.handler(req('guest-discover'))).status,403);
 assert.deepEqual(x.counts(),{db:0,discover:0});
});
test('unauthenticated member discovery denied before DB',async()=>{
 const x=setup();assert.equal((await x.handler(req('discover'))).status,401);
 assert.deepEqual(x.counts(),{db:0,discover:0});
});
test('wrong owner member discovery denied before DB',async()=>{
 const x=setup('22222222-2222-4222-8222-222222222222');
 assert.equal((await x.handler(req('discover',true))).status,403);
 assert.deepEqual(x.counts(),{db:0,discover:0});
});
test('owner check allowed, unsupported modes blocked',async()=>{
 const x=setup();assert.equal((await x.handler(req('owner-check',true))).status,200);
 assert.equal((await x.handler(req('anything',true))).status,404);
 assert.deepEqual(x.counts(),{db:0,discover:0});
});
