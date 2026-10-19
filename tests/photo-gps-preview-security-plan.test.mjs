import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/photo-gps-preview-function-review.sql',import.meta.url),'utf8');

test('preview SQL is explicitly non-executable and not a migration',()=>{
 assert.match(sql,/REVIEW-ONLY TEMPLATE/);
 assert.match(sql,/DO NOT EXECUTE/);
 assert.match(sql,/<INSERT EXACT REVIEWED BODY/);
 assert.doesNotMatch(sql,/^CREATE FUNCTION/m);
 assert.doesNotMatch(sql,/^GRANT EXECUTE/m);
});
test('preview plan rejects unrestricted owner UUID and guest exposure',()=>{
 assert.match(sql,/could\s*\n-- supply a different owner UUID/);
 assert.match(sql,/negative test using a second owner UUID/);
 assert.match(sql,/Never expose preview through guest-discover/);
});
test('preview plan preserves production privileges and rollback requirements',()=>{
 assert.match(sql,/Never modify production guest_known_stores/);
 assert.match(sql,/grant direct table SELECT/);
 assert.match(sql,/REVOKE its/);
});
