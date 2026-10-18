import assert from 'node:assert/strict';
import {adaptiveNearby} from '../supabase/functions/navi-discover/adaptive-search.mjs';
const center={latitude:32.74333,longitude:129.87572};
const candidate=(id,name)=>({id,name,latitude:center.latitude,longitude:center.longitude,mode:'eat',tags:[]});
const run=async(load,hint='万徳')=>adaptiveNearby({input:{hint,category:'おまかせ',mode:'eat',photoStoreLookup:true},center,load,knownStores:async()=>[]});
{
 let calls=0;const result=await run(async()=>{calls++;return {candidates:[],partial:false};});
 assert.equal(calls,6);assert.equal(result.candidates.length,0);assert.equal(result.partial,true);
}
{
 let calls=0;const result=await run(async(radius,keyword)=>{calls++;return {candidates:keyword?[candidate('one','万徳')]:[candidate('other','別の店')],partial:false};});
 assert.equal(calls,2);assert.equal(result.candidates.some(c=>c.name==='万徳'),true);
}
{
 let calls=0;const result=await run(async(radius,keyword)=>{calls++;if(keyword)throw Error('provider unavailable');return {candidates:[candidate('other','別の店')],partial:false};});
 assert.equal(calls,2);assert.equal(result.partial,true);assert.equal(result.candidates.length,1);
}
{
 let calls=0;await assert.rejects(run(async()=>{calls++;throw Error('provider unavailable');}),/search_unavailable/);assert.equal(calls,1);
}

// Guest mode may stop on enough generic results; photo mode must continue looking for the named store.
{
 const generic=Array.from({length:8},(_,i)=>candidate('generic-'+i,'別の店'+i));
 let guestCalls=0;
 const guest=await adaptiveNearby({input:{hint:'万徳',category:'おまかせ',mode:'eat',photoStoreLookup:false},center,knownStores:async()=>[],load:async()=>{guestCalls++;return {candidates:generic,partial:false};}});
 let photoCalls=0;
 const photo=await run(async()=>{photoCalls++;return {candidates:generic,partial:false};});
 assert.ok(guestCalls<photoCalls,'photo lookup continues after guest search may stop');
 assert.equal(photoCalls,6,'photo mode checks bounded provider queries');
 assert.equal(photo.partial,true,'no name match is reported as incomplete');
 assert.equal(guest.candidates.some(c=>c.name.includes('万徳')),false);
}

{
 const storeId='11111111-1111-4111-8111-111111111111';
 const known={...candidate('known:'+storeId,'登録済み店舗'),store_id:storeId,source_kind:'known_store'};
 const result=await adaptiveNearby({input:{category:'おまかせ',mode:'eat'},center,knownStores:async()=>[known],load:async()=>({candidates:[],partial:false})});
 assert.equal(result.candidates.some(c=>c.store_id===storeId),true,'known store must be returned, not just used to stop search');
}
