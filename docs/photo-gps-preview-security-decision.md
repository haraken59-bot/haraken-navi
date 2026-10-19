# Isolated smartphone GPS preview: decision and security gate

## Options

| Option | Isolation | Setup effort | Main risk |
| --- | --- | --- | --- |
| Separate Supabase project | Strongest (data, Auth, DB, Edge isolated) | High: seed safe fixtures, configure keys and deployment | Misconfigured credentials or accidentally copied personal data |
| Dedicated owner-scoped function in existing DB | Logical separation, not physical | Lower | Excessive EXECUTE grants, SECURITY DEFINER privilege escalation, exposure through public guest endpoint |

**Provisional preference:** a dedicated, owner-scoped SECURITY DEFINER preview function with explicit EXECUTE for the existing restricted runtime role, but **only after independent review and explicit approval**. No database changes are authorized by this plan.

## Verified live permissions (read-only)
- Production `navi_internal.guest_known_stores`: owner `postgres`, SECURITY DEFINER, EXECUTE granted to `navi_discover_runtime` only (apart from owner).
- Test `navi_internal.guest_known_stores_unvisited_test`: owner `postgres`, SECURITY INVOKER, EXECUTE granted only to owner; no EXECUTE for runtime.
- Neither function grants EXECUTE to `anon` or `authenticated`.
- Both use `search_path=pg_catalog`, `statement_timeout=3s`.
- Runtime has no direct SELECT on `public.stores`, `public.store_visits`, `public.meals`, or `public.meal_details`.

## Required gates before any live preview
1. Do not change the existing production function or grant direct table SELECT to the runtime role.
2. Create a separate preview function with a narrowly scoped signature, owner filter, search_path, 3s timeout, explicit EXECUTE ACL and least-privilege review. Avoid dynamic SQL and caller-supplied owner identity.
3. Require authenticated owner-only endpoint; public guest-discover must never invoke preview function or return personal stores or visit badges.
4. Preview deployment must be isolated from the published function and public GitHub Pages site. No public endpoint, credentials or URLs until separately authorized.
5. Verify 0/1/2+ visit statuses, nearest 50 among 80, 500m boundary, invalid GPS, excluded closed/test stores, cross-owner denial, unauthenticated denial, and cleanup.
6. Verify browser origin restrictions and mobile session flow without logging tokens or personal store data.
7. Explicit rollback and teardown instructions before any test deployment.

## Current decision
- No live preview environment is deployed.
- CI run #157 passed mock HTTP → search service → test reader integration.
- The live 80-store rollback test passed for the test-only function under privileged SQL execution, **not** under the restricted runtime role.
- This document is planning only; no production SQL, ACL, deployment, or user data is changed.
