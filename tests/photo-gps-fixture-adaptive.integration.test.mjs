import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveNearby} from '../supabase/functions/navi-discover/adaptive-search.mjs';

const center={latitude:32.74,longitude:129.88};
const fixture=(id,name,lat,used,revisited)=>({id:'known:'+id,store_id:id,name,latitude:lat,longitude:center.longitude,kind:'store',mode:'both',source_kind:'known_store',haraken_usage:revisited?'revisited':used?'used':'unvisited'});
const stores=[
 fixture('11111111-1111-4111-8111-111111111111','検証用・未訪問店',32.74001,false,false),
 fixture('22222222-2222-4222-8222-222222222222','検証用・訪問1回店',32.7402,true,false),
 fixture('33333333-3333-4333-8333-333333333333','検証用・訪問2回店',32.7403,true,true),
 fixture('44444444-4444-4444-8444-444444444444','検証用・範囲外店',32.77,false,false)
];
const input={photoStoreLookup:true,hint:'',category:'',mode:'eat'};
const load=async()=>({candidates:[],partial:false,fetched_at:'2026-10-19T00:00:00Z'});
test('real adaptive GPS search merges synthetic registered stores missing from provider, with correct usage',async()=>{
 const result=await adaptiveNearby({input,center,load,includeKnownStores:true,knownStores:async()=>stores});
 assert.deepEqual(result.candidates.map(x=>x.haraken_usage),['unvisited','used','revisited']);
 assert.equal(result.candidates.every(x=>x.source_kind==='known_store'),true);
 assert.equal(result.candidates.some(x=>x.name.includes('範囲外')),false);
});
test('guest GPS path never calls owner known-store reader',async()=>{
 let called=false;
 const result=await adaptiveNearby({input,center,load,includeKnownStores:false,knownStores:async()=>{called=true;throw Error('private_reader_called')}});
 assert.equal(called,false);
 assert.deepEqual(result.candidates,[]);
});
