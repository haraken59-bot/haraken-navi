import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/navi-discover/handler.mjs';
import {createSearchService} from '../supabase/functions/navi-discover/search-service.mjs';
import {createKnownStoreReader} from '../supabase/functions/navi-discover/known-stores.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const center={latitude:32.74,longitude:129.88};
const store={store_id:'22222222-2222-4222-8222-222222222222',name:'餃子菜館 万徳',latitude:32.7401,longitude:129.88,used:false,revisited:false};
const state={cached:async()=>null,acquire:async()=>true,save:async()=>true,finish:async()=>true};
const request=async url=>{assert.match(String(url),/hotpepper/);return {ok:true,json:async()=>({results:{shop:[],results_available:0}})};};

test('authenticated HTTP GPS photo search reaches test-only DB and returns unvisited known store',async()=>{
 const queries=[];
 const db={withConnection:async cb=>cb({query:async(sql,args)=>{queries.push({sql,args});return {rows:[store]};}})};
 const knownStores=createKnownStoreReader(db,owner,{testFunction:true});
 const discover=createSearchService({state,knownStores,includeKnownStores:true,request,readEnv:key=>key==='HOTPEPPER_API_KEY'?'mock-key':undefined});
 const handler=createHandler({ownerId:owner,verifyUser:async()=>({user_id:owner}),database:db,discover,guestDiscover:async()=>{throw Error('guest not expected');}});
 const res=await handler(new Request('https://example.test/?mode=discover&photoStoreLookup=1&gpsLatitude=32.74&gpsLongitude=129.88&hint=%E4%B8%87%E5%BE%B3',{headers:{authorization:'Bearer abc.def.ghi'}}));
 assert.equal(res.status,200);
 const body=await res.json();
 assert.ok(body.candidates.some(x=>x.name==='餃子菜館 万徳'&&x.haraken_usage==='unvisited'));
 assert.ok(queries.length>0);
 assert.ok(queries.every(q=>q.sql.includes('guest_known_stores_unvisited_test(')));
 assert.equal(queries[0].args[0],owner);
});

test('unauthenticated HTTP GPS request cannot read known-store DB',async()=>{
 let reads=0;
 const db={withConnection:async()=>{reads++;throw Error('private DB read');}};
 const handler=createHandler({ownerId:owner,database:db,verifyUser:async()=>null,discover:async()=>{throw Error('must not call');}});
 const res=await handler(new Request('https://example.test/?mode=discover&gpsLatitude=32.74&gpsLongitude=129.88'));
 assert.equal(res.status,401);
 assert.equal(reads,0);
});

test('owner-authenticated HTTP GPS search reads three synthetic DB visit states, never production RPC',async()=>{
 const fakeRows=[
  {store_id:'33333333-3333-4333-8333-333333333333',name:'架空・未訪問',latitude:32.74001,longitude:129.88,used:false,revisited:false},
  {store_id:'44444444-4444-4444-8444-444444444444',name:'架空・訪問済',latitude:32.7402,longitude:129.88,used:true,revisited:false},
  {store_id:'55555555-5555-4555-8555-555555555555',name:'架空・再訪問',latitude:32.7403,longitude:129.88,used:true,revisited:true},
  {store_id:'66666666-6666-4666-8666-666666666666',name:'架空・範囲外',latitude:32.77,longitude:129.88,used:false,revisited:false},
 ];
 const queries=[];
 const db={withConnection:async cb=>cb({query:async(sql,args)=>{queries.push({sql,args});return {rows:fakeRows};}})};
 const knownStores=createKnownStoreReader(db,owner,{testFunction:true});
 const discover=createSearchService({state,knownStores,includeKnownStores:true,request,readEnv:key=>key==='HOTPEPPER_API_KEY'?'mock-key':undefined});
 const handler=createHandler({ownerId:owner,verifyUser:async()=>({user_id:owner}),database:db,discover,guestDiscover:async()=>{throw Error('guest not expected');}});
 const res=await handler(new Request('https://example.test/?mode=discover&photoStoreLookup=1&gpsLatitude=32.74&gpsLongitude=129.88',{headers:{authorization:'Bearer abc.def.ghi'}}));
 assert.equal(res.status,200);
 const data=await res.json();
 assert.deepEqual(data.candidates.map(c=>c.haraken_usage),['unvisited','used','revisited']);
 assert.equal(data.candidates.some(c=>c.name.includes('範囲外')),false);
 assert.ok(queries.length>0);
 assert.ok(queries.every(q=>q.sql.includes('guest_known_stores_unvisited_test(')&&!q.sql.includes('guest_known_stores(')));
 assert.ok(queries.every(q=>q.args[0]===owner));
});
test('wrong-owner authenticated HTTP request is denied before synthetic DB read',async()=>{
 let reads=0,searches=0;
 const db={withConnection:async()=>{reads++;throw Error('should not read DB')}};
 const handler=createHandler({ownerId:owner,database:db,verifyUser:async()=>({user_id:'77777777-7777-4777-8777-777777777777'}),discover:async()=>{searches++;}});
 const res=await handler(new Request('https://example.test/?mode=discover&gpsLatitude=32.74&gpsLongitude=129.88',{headers:{authorization:'Bearer abc.def.ghi'}}));
 assert.equal(res.status,403);
 assert.equal(reads,0);
 assert.equal(searches,0);
});
