import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveNearby} from '../supabase/functions/navi-discover/adaptive-search.mjs';

const center={latitude:32.74,longitude:129.88};
const known={id:'known:1',store_id:'11111111-1111-4111-8111-111111111111',name:'餃子菜館 万徳',latitude:32.7401,longitude:129.88,kind:'store',mode:'both',source_kind:'known_store',haraken_usage:'unvisited'};
const input={photoStoreLookup:true,hint:'万徳',category:'',mode:'eat'};
const load=async()=>({candidates:[],partial:false,fetched_at:'2026-10-19T00:00:00Z'});

test('authenticated photo GPS search includes unvisited registered store absent from external provider',async()=>{
 let calls=0;
 const result=await adaptiveNearby({input,center,load,includeKnownStores:true,knownStores:async()=>{calls++;return [known];}});
 assert.ok(calls>0);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].name,'餃子菜館 万徳');
 assert.equal(result.candidates[0].haraken_usage,'unvisited');
});
test('guest photo GPS search does not return private known stores',async()=>{
 const result=await adaptiveNearby({input,center,load,includeKnownStores:false,knownStores:async()=>[known]});
 assert.deepEqual(result.candidates,[]);
});
