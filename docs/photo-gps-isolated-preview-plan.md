# GPS photo-search isolated verification (PR #11 only)

## Current wiring
- `supabase/functions/navi-discover/index.ts` calls `createKnownStoreReader(database, ownerId)` with **no test option**, so the deployed entrypoint keeps using `navi_internal.guest_known_stores`.
- For isolated test harnesses only, `createKnownStoreReader(database, ownerId, {testFunction:true})` selects `navi_internal.guest_known_stores_unvisited_test`.
- The function name is chosen from two hardcoded literals; it is **never** taken from URL query parameters, user input, or browser local storage.
- No deployment, test URL, or mobile preview is created by this change.

## Safe next step
1. Run Node CI on this branch, including the explicit routing test.
2. In a local isolated harness, inject the test reader and mock external providers; assert that photo GPS center and 500m radius include an unvisited known store.
3. Only after reviewing origin, authentication, personal-store visibility and endpoint permissions, prepare a separately authorized preview environment. Do **not** point the public GitHub Pages app at the test function.
4. Smartphone end-to-end testing requires a real preview URL and controlled deployment; neither exists yet.

## Important limitations
- The production function is still the old inner-join/planar-distance version.
- A known store must already be registered in the owner's database. This does not discover unregistered shops absent from external APIs.
- Guest endpoint behavior needs privacy review before any preview deployment: `handler.mjs` merges owner-known stores into `guest-discover` responses.

## CI evidence
- Recommendation regression workflow run #154 (39265684250) completed successfully, including guest privacy and photo GPS owner/guest integration tests.
- These tests use mocks; they do not prove that the currently deployed Edge Function uses the test-only database function.
- **Blocking discrepancy:** `index.ts` currently constructs `createKnownStoreReader(database, ownerId)`, which defaults to production `guest_known_stores`. Therefore the fixed unvisited behavior is NOT available from the deployed function yet. Do not claim the smartphone preview is ready.
- The explicit `{testFunction:true}` selector exists for an isolated harness, not for browser-controlled toggles.
- Next safe verification: run a full handler → search service → reader integration using a mock DB, then review a dedicated authenticated preview deployment. Deployment requires separate authorization.

## Live read-only permissions check (2026-10-19)
- CI run #157 (39266109837) completed successfully, including HTTP handler → search service → mocked DB reader.
- Database role `navi_discover_runtime` has EXECUTE on production `navi_internal.guest_known_stores`, but **does not** have EXECUTE on `guest_known_stores_unvisited_test`.
- The runtime role has **no SELECT** on `public.stores`, `public.store_visits`, `public.meals`, or `public.meal_details`.
- The test function is SECURITY INVOKER, so granting only EXECUTE would still not suffice to read these tables. Do not grant direct SELECT to this restricted runtime role as a shortcut.
- A real preview requires a separately reviewed, owner-scoped SECURITY DEFINER test function with narrowly scoped EXECUTE, or a truly isolated database environment, plus separate deployment authorization.
- **No DB privilege, function, secret, or deployed endpoint was changed by this inspection.**
