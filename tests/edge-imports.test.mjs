import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['supabase/functions/navi-discover/index.ts','supabase/functions/navi-discover/search-state.mjs','supabase/functions/navi-discover/diagnostics.mjs','supabase/functions/navi-discover/search-service.mjs','supabase/functions/navi-discover/adaptive-search.mjs','app/places.js','app/genre-fit.js','supabase/functions/navi-discover/known-stores.mjs','supabase/functions/navi-discover/known-places.mjs','app/scripts/hotpepper-service.mjs','supabase/functions/navi-discover/db-runtime.ts','supabase/functions/navi-discover/db.mjs','supabase/functions/navi-discover/handler.mjs','supabase/functions/navi-discover/guest-search.mjs','supabase/functions/navi-discover/guest-state.mjs','supabase/functions/navi-discover/guest-usage.mjs'];
for(const file of files){
 const absolute=resolve(root,file);
 const source=readFileSync(absolute,'utf8');
 const lines=source.split('\n');
 for(const line of lines){
  const match=line.match(/from ['"](\.[^'"]+)['"]/);
  if(match)assert.ok(existsSync(resolve(dirname(absolute),match[1])),file+' missing '+match[1]);
 }
}
