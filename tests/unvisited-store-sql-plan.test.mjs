import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/unvisited-store-db-test-plan.sql',import.meta.url),'utf8');
test('DB patch plan uses LEFT JOIN and preserves visit flags',()=>{
 assert.match(sql,/LEFT JOIN days/i);
 assert.match(sql,/count\(DISTINCT d\.visit_day\)>0 AS used/i);
 assert.match(sql,/count\(DISTINCT d\.visit_day\)>=2 AS revisited/i);
});
test('DB patch plan explicitly retains safety filters',()=>{
 for(const term of ['user_id','is_test','location_updated_at','closure']) assert.ok(sql.includes(term),term);
 assert.match(sql,/TEST DATABASE/i);
});
