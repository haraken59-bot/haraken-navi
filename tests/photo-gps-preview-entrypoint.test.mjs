import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const entry=readFileSync(new URL('../supabase/functions/navi-discover-photo-preview/index.ts',import.meta.url),'utf8');
const production=readFileSync(new URL('../supabase/functions/navi-discover/index.ts',import.meta.url),'utf8');
test('preview entrypoint binds owner from protected env, not request or source literal',()=>{
 assert.match(entry,/Deno\.env\.get\('NAVI_OWNER_USER_ID'\)/);
 assert.match(entry,/createOwnerBoundPreviewReader\(database,ownerId\)/);
 assert.match(entry,/createPhotoPreviewHandler/);
 assert.match(entry,/includeKnownStores:true/);
 assert.doesNotMatch(entry,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});
test('production entrypoint remains on original four-argument reader',()=>{
 assert.match(production,/createKnownStoreReader\(database, ownerId\)/);
 assert.doesNotMatch(production,/createOwnerBoundPreviewReader/);
});
