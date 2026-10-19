# Smartphone GPS preview — pre-deployment go/no-go checklist

**Status: NO-GO.** This checklist is not deployment authorization. CI #169 passed, but there is no deployed preview function, endpoint or mobile test URL.

## Confirmed in PR #11
- Test-only SQL template has no executable statements and includes an owner-scoped, three-argument function design.
- A preview-only JS reader issues a three-argument SQL call without an owner UUID; the production entrypoint still uses the existing four-argument reader.
- Tests cover malformed GPS, invalid configured owner UUID, missing JWT and a different JWT owner in the existing handler test harness.
- CI #169 succeeded for commit f2e48493792c92fa8ecf0a5df06f8c77b9463407.
- Production DB function, permissions, public site, and main branch have not been changed by this work.

## Blocking before any deployment
1. **Explicit user authorization** for a new DB function and separate Edge preview deployment. The user has only approved continuing planning and test-branch work so far.
2. **Identity binding:** the preview reader validates only that the configured owner is a UUID; it does NOT authenticate the requester. The preview endpoint must verify JWT owner equality before invoking the reader. Do not expose the reader directly.
3. **Real owner binding:** migration must inject the configured owner UUID securely, with no real UUID committed or logged. The SQL template remains fully commented and cannot run as-is.
4. **DB security:** independent review of SECURITY DEFINER owner, search_path, function name qualification, default PUBLIC EXECUTE revocation, role grants, and cross-owner negative tests. No runtime direct table SELECT.
5. **Isolation:** deploy a distinct Edge Function name, separate origin allowlist and preview-only client configuration. Do not change published navi-discover or GitHub Pages.
6. **Functional tests:** verify actual DB runtime role can call only the new three-argument function; verify 0/1/2 visits, 80 nearest 50, 499/500/501m, cross-owner denial, guest denial, excluded stores, invalid GPS and cleanup.
7. **Teardown:** remove preview endpoint, revoke preview EXECUTE, drop only preview function, verify production grants and function definition unchanged.

## Practical recommendation
Continue code review and CI in PR #11 without touching production. When ready for a live phone test, request a **separate, explicit approval** for the exact DB and Edge operations. If the priority is maximal data isolation, choose a separate Supabase test project instead of a preview function in the existing project.
