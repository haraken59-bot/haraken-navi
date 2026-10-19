// Dedicated, not-yet-deployed preview entrypoint. Never overwrite navi-discover
// or navi-discover-photo-test. No secret values are embedded in this source.
import {createSearchState} from '../navi-discover/search-state.mjs';
import {createSearchService} from '../navi-discover/search-service.mjs';
import {createRuntimeDatabaseConnection} from '../navi-discover/db-runtime.ts';
import {createUserVerifier,allowedOrigins} from '../navi-discover/handler.mjs';
import {createOwnerBoundPreviewReader} from '../navi-discover/known-stores.mjs';
import {createPhotoPreviewHandler} from './preview-handler.mjs';

const database=createRuntimeDatabaseConnection();
const ownerId=Deno.env.get('NAVI_OWNER_USER_ID');
const knownStores=createOwnerBoundPreviewReader(database,ownerId);
const verifyUser=createUserVerifier({
 supabaseUrl:Deno.env.get('SUPABASE_URL'),
 publishableKey:Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY')
});
const discover=createSearchService({
 state:createSearchState(database),
 knownStores,includeKnownStores:true,
 readEnv:(key:string)=>Deno.env.get(key)
});
Deno.serve(createPhotoPreviewHandler({
 verifyUser,database,ownerId,discover,
 origins:allowedOrigins(Deno.env.get('NAVI_ALLOWED_ORIGINS'))
}));
