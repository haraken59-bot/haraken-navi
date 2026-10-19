import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticPreview} from '../supabase/functions/navi-photo-fixture/fixture.mjs';
const request=(query,init)=>new Request('https://fixture.example/?'+query,init);
test('synthetic GPS results include 0/1/2 visits but exclude out-of-range fixture',async()=>{
 const r=await syntheticPreview(request('latitude=32.744&longitude=129.876&radius_m=500'));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.fixture_only,true);
 assert.deepEqual(new Set(body.candidates.map(x=>x.haraken_usage)),new Set(['unvisited','used','revisited']));
 assert.equal(body.candidates.every(x=>x.fixture_only),true);
});
test('invalid coordinates and unapproved origin are rejected',async()=>{
 assert.equal((await syntheticPreview(request('longitude=1'))).status,400);
 assert.equal((await syntheticPreview(request('latitude=0&longitude=0',{headers:{origin:'https://evil.example'}}))).status,403);
});
