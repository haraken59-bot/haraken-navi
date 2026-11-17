import { createSearchState } from './search-state.mjs';
import { createSearchService } from './search-service.mjs';
import { createRuntimeDatabaseConnection } from './db-runtime.ts';
import { createHandler, createUserVerifier, allowedOrigins } from './handler.mjs';
import { createGuestState } from './guest-state.mjs';
import { createUsageReader } from './guest-usage.mjs';
import { createKnownStoreReader } from './known-stores.mjs';

// Adapter construction is lazy: no DB Secret read or connection at startup.
const database = createRuntimeDatabaseConnection();
const state = createSearchState(database);
const ownerId = Deno.env.get('NAVI_OWNER_USER_ID');
const knownStores = createKnownStoreReader(database, ownerId);

// Built-in Auth connection; no admin key.
const verifyUser = createUserVerifier({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  publishableKey: Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY'),
});

Deno.serve(createHandler({
  verifyUser,
  database,
  ownerId,
  usage: createUsageReader(database, ownerId),
  knownStores,
  discover: createSearchService({ knownStores, state, readEnv: (name: string) => Deno.env.get(name) }),
  guestDiscover: createSearchService({ knownStores, state: createGuestState((key: string) => state.cached(key)), readEnv: (name: string) => Deno.env.get(name) }),
  origins: allowedOrigins(Deno.env.get('NAVI_ALLOWED_ORIGINS')),
}));
