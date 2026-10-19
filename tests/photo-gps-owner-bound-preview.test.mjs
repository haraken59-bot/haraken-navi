import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler} from '../supabase/functions/navi-discover/handler.mjs';
const sql=readFileSync(new URL('../docs/photo-gps-owner-bound-preview-template.sql',import.meta.url),'utf8');

test('preview SQL is inert, has three arguments and no caller-provided owner',()=>{
 assert.ok(sql.split('\n').every(line=>!line.trim()||line.trim().startsWith('--')));
 assert.match(sql,/CREATE FUNCTION navi_internal\.guest_known_stores_unvisited_preview\(/);
 assert.match(sql,/lat double precision, lng double precision, radius_m integer/);
 assert.doesNotMatch(sql,/owner_id uuid,/);
 assert.match(sql,/<MIGRATION_INJECTED_OWNER_UUID>/);
 assert.match(sql,/s\.user_id=o\.owner_id/);
 assert.match(sql,/v\.user_id=o\.owner_id/);
 assert.match(sql,/m\.user_id=o\.owner_id/);
});
test('preview SQL preserves distance, visit flags and restrictive grants',()=>{
 assert.match(sql,/12742000 \* asin/);
 assert.match(sql,/LEFT JOIN days/);
 assert.match(sql,/ORDER BY s\.distance_m,s\.id LIMIT 50/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/search_path = pg_catalog/);
 assert.match(sql,/statement_timeout = '3s'/);
 assert.match(sql,/FROM PUBLIC/);
 assert.match(sql,/FROM anon,authenticated/);
 assert.match(sql,/TO navi_discover_runtime/);
});
test('wrong owner and missing JWT are rejected before DB reads',async()=>{
 let reads=0,searches=0;
 const handler=createHandler({
  ownerId:'11111111-1111-4111-8111-111111111111',
  verifyUser:async()=>({user_id:'99999999-9999-4999-8999-999999999999'}),
  database:{withConnection:async()=>{reads++;throw Error('private DB');}},
  discover:async()=>{searches++;return {candidates:[]};}
 });
 const base='https://example.test/?mode=discover&gpsLatitude=32.74&gpsLongitude=129.88';
 const absent=await handler(new Request(base));
 assert.equal(absent.status,401);
 const wrong=await handler(new Request(base,{headers:{authorization:'Bearer abc.def.ghi'}}));
 assert.equal(wrong.status,403);
 assert.equal(reads,0);
 assert.equal(searches,0);
});
