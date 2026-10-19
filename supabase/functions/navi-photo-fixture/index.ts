import {syntheticPreview} from './fixture.mjs';
// Synthetic-only endpoint: no imports from DB/auth/provider modules.
Deno.serve(syntheticPreview);
