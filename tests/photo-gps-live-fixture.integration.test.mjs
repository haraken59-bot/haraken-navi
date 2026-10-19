import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveNearby} from '../supabase/functions/navi-discover/adaptive-search.mjs';

const endpoint='https://vflxbadvyilfjoypnhtx.supabase.co/functions/v1/navi-photo-db-fixture';
const center={latitude:32.74,longitude:129.88};
const input={photoStoreLookup:true,hint:'',category:'',mode:'eat'};

test('real HTTP Edge -> real Supabase SQL fixture -> actual GPS adaptive merge',async()=>{
 const response=await fetch(endpoint,{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,'isolated synthetic endpoint must be available');
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.equal(body.fixture_only,true);
 assert.deepEqual(body.center,center);
 assert.equal(body.radius_m,500);
 assert.equal(body.stores.length,3);
 assert.ok(body.stores.every(row=>row.name.startsWith('架空・')));
 const knownStores=async(point,radius)=>body.stores.map((row,index)=>({
  id:'known:synthetic-'+index,
  store_id:['33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444'][index],
  name:row.name,latitude:row.latitude,longitude:row.longitude,
  kind:'store',mode:'both',source_kind:'known_store',
  haraken_usage:row.revisited?'revisited':row.used?'used':'unvisited'
 }));
 const load=async()=>({candidates:[],partial:false,fetched_at:'2026-10-20T00:00:00Z'});
 const result=await adaptiveNearby({input,center,knownStores,includeKnownStores:true,load});
 assert.equal(result.candidates.length,3);
 assert.deepEqual(new Set(result.candidates.map(x=>x.haraken_usage)),new Set(['unvisited','used','revisited']));
 assert.ok(result.candidates.every(x=>x.source_kind==='known_store'));
 assert.ok(result.candidates.every(x=>x.name.startsWith('架空・')));
});

test('registered synthetic unvisited store remains discoverable with photo name hint even when external provider is empty',async()=>{
 const response=await fetch(endpoint,{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.fixture_only,true);
 const knownStores=async()=>body.stores.map((row,index)=>({
  id:'known:synthetic-'+index,
  store_id:['33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444'][index],
  name:row.name,latitude:row.latitude,longitude:row.longitude,kind:'store',mode:'both',
  source_kind:'known_store',haraken_usage:row.revisited?'revisited':row.used?'used':'unvisited'
 }));
 let providerCalls=0;
 const load=async()=>{providerCalls++;return {candidates:[],partial:false,fetched_at:'2026-10-20T00:00:00Z'}};
 const result=await adaptiveNearby({input:{...input,hint:'架空・未訪問'},center,knownStores,includeKnownStores:true,load});
 assert.ok(providerCalls>0);
 assert.ok(result.candidates.some(c=>c.name==='架空・未訪問'&&c.haraken_usage==='unvisited'));
 assert.ok(result.candidates.every(c=>c.source_kind==='known_store'));
});
test('live synthetic fixture never reaches guest known-store reader',async()=>{
 let reads=0;
 const load=async()=>({candidates:[],partial:false,fetched_at:'2026-10-20T00:00:00Z'});
 const result=await adaptiveNearby({input,center,load,includeKnownStores:false,knownStores:async()=>{reads++;throw Error('guest cannot read known stores')}});
 assert.equal(reads,0);
 assert.equal(result.candidates.length,0);
});
