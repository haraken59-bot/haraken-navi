# Preview owner binding: approved architecture, pending provisioning

## Resolution
**Do not query personal store rows to discover an owner ID.** The existing `navi-discover` function uses `NAVI_OWNER_USER_ID` in server-only environment configuration, and the production handler verifies a user JWT against this ID before member discovery. Reuse this *configuration pattern*, not the secret value, for a separately named preview endpoint.

For the DB function, a `SECURITY DEFINER` function accepting an arbitrary owner UUID would be unsafe. Use a preview-only function with **no owner UUID parameter**, with owner fixed at creation time by an approved migration. Do not copy the UUID into GitHub or logs.

## Provisioning sequence (not executed)
1. Review the configured owner in Supabase's protected server settings through an authorized secret-management channel. Never print its value in logs or assistant output.
2. During a separately approved migration, bind the same owner to the preview-only function using a protected migration substitution. Verify its ACL permits only `navi_discover_runtime`.
3. Use `NAVI_OWNER_USER_ID` inside the distinct preview Edge Function to validate JWT owner equality. A preview-only reader invokes the three-argument function.
4. Keep the deployed `navi-discover` and existing `navi-discover-photo-test` unchanged.
5. Test wrong-owner JWT, absent JWT, guest route, 0/1/2 visit flags, nearest 50, and teardown.

## Current limitations
- CI #173 passed owner-only preview handler tests, but the preview handler has not been deployed.
- No new database preview function exists as of the last read-only check.
- The preview-only handler and reader are separate components; a complete deployable preview entrypoint has not yet been built.
- The user's approval permits a distinct preview function and endpoint, but no live operation should proceed without resolving protected owner configuration and reviewing a deployable bundle.
- Do not use `public.stores` queries to infer an owner. Do not grant direct table SELECT to the runtime role.
