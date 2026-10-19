# Owner-bound preview function: review-only security design

No SQL in this document has been executed. This is a design decision, **not** a migration.

## Recommended owner binding

The existing preview design accepts `owner_id uuid` from a caller. This is insufficient for a SECURITY DEFINER function: a caller with EXECUTE may submit another person's UUID.

Use a dedicated preview function with **no owner_id argument**. Resolve the single allowed owner from a trusted database-side constant established during a separately approved migration, rather than from HTTP query parameters, JWT claims passed as SQL parameters, or a user-controlled PostgreSQL session setting.

Possible reviewed implementation:
1. Create `navi_internal.guest_known_stores_unvisited_preview(lat float8,lng float8,radius_m integer)`, with no owner_id argument.
2. Bind a single owner UUID inside the function body from a **migration-controlled constant**, not an input argument. Do not put a real UUID in the repository.
3. Use `SECURITY DEFINER`, `SET search_path=pg_catalog`, `SET statement_timeout='3s'`, fully qualified table and helper names; preserve the existing verified Haversine, nearest-50, visit-status and exclusion logic.
4. Revoke EXECUTE from PUBLIC, anon and authenticated; grant only to `navi_discover_runtime`. No direct table SELECT grants.
5. Preview Edge handler must independently verify the same configured owner's JWT before executing the function, reject guest access, and have a distinct endpoint and secrets from production.
6. Do not pass an owner UUID to the SQL call. Adapt the preview-only reader to the three-argument function signature; leave production reader unchanged.
7. Test with valid owner, wrong owner JWT, no JWT, invalid GPS, and SQL attempts to call the preview function with an owner UUID (which must fail because no four-argument overload exists).
8. Remove the dedicated endpoint, revoke EXECUTE, drop the preview function, and confirm no production ACL or function changed.

## Security tradeoff

A fixed-owner function prevents cross-owner reads via a caller-supplied UUID. However, theft of the runtime DB credential could still reveal the one configured owner's nearby store data. This is a bounded risk, **not complete isolation**. A separate Supabase project remains the stronger option if data exposure risk is unacceptable.

Do not commit actual owner UUIDs, database passwords, tokens, or connection strings. No deployment or DB grants without explicit authorization.

## Verification

- 2026-10-19 read-only inspection: PostgreSQL 17.6; runtime role exists; preview function does not yet exist.
- CI #162 passed static security-plan checks.
- Next: prepare a non-executable, fully reviewed function definition and negative tests. Stop before deployment and request explicit approval.
