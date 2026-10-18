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
