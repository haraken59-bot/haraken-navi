import { stageLogger } from './diagnostics.mjs';
import { parseSearch } from './search-service.mjs';
import { parseGuestSearch, guestAdmission, publicSearchResult } from './guest-search.mjs';
import { mergeKnownStores } from './known-stores.mjs';
import { withinSearch } from '../../../app/places.js';

const LOCAL_ORIGINS = ['http://127.0.0.1:8140', 'http://localhost:8140'];
// Exact approved outdoor-test origin; no wildcard.
const OUTDOOR_ORIGIN = 'https://supreme-each-undrafted.ngrok-free.dev';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTH_HEADERS = ['authorization', 'apikey', 'x-client-info', 'content-type'];

// Exact origins only; never allow every ngrok domain or reflect arbitrary origins.
export function allowedOrigins(config) {
  return new Set([...LOCAL_ORIGINS, OUTDOOR_ORIGIN, 'https://haraken59-bot.github.io', ...(config || '').split(',').map(x => x.trim()).filter(x => {
    try { const u = new URL(x); return u.protocol === 'https:' && u.origin === x; }
    catch { return false; }
  })]);
}

// Auth server validates the supplied user JWT. Never trust a locally decoded sub.
// Works with legacy and asymmetric user JWTs; no JWT signing secret is needed.
export function createUserVerifier({ supabaseUrl, publishableKey, request = fetch } = {}) {
  let endpoint;
  try {
    const u = new URL(supabaseUrl);
    if (u.protocol === 'https:' && u.hostname.endsWith('.supabase.co') &&
        !u.username && !u.password && !u.port && u.pathname === '/' && !u.search && !u.hash) {
      endpoint = new URL('/auth/v1/user', u).href;
    }
  } catch { /* Unconfigured: fail closed when called. */ }
  return async token => {
    if (!endpoint || !publishableKey) throw new Error('auth_unavailable');
    const response = await request(endpoint, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('auth_unavailable');
    const user = await response.json();
    if (!UUID.test(user?.id || '') || user.role !== 'authenticated' || user.is_anonymous !== false) return null;
    return { user_id: user.id };
  };
}

// runAuthenticated is server-side wiring only, never selected by request input.
// The current skeleton does no work and therefore opens no database connection.
export function createHandler({ verifyUser, database, discover, guestDiscover, usage = async () => [], knownStores = async () => [], ownerId, runAuthenticated = async () => {},
  origins = allowedOrigins(), log }) {
  const stage = stageLogger(log);
  const admitGuest = guestAdmission();
  return async req => {
    const origin = req.headers.get('origin');
    const headers = {
      'Cache-Control': 'no-store', 'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
    };
    const reply = (status, error) => Response.json(
      error ? { ok: false, error } : { ok: true, authenticated: true },
      { status, headers },
    );
    if (origin && !origins.has(origin)) return reply(403, 'origin_not_allowed');
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (!['GET', 'OPTIONS'].includes(req.method)) {
      headers.Allow = 'GET, OPTIONS';
      return reply(405, 'method_not_allowed');
    }
    // Browser preflight has no user JWT. It authorizes transport, never search.
    if (req.method === 'OPTIONS') {
      const requested = (req.headers.get('access-control-request-headers') || '')
        .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
      if (!origin || req.headers.get('access-control-request-method') !== 'GET' ||
          requested.some(x => !AUTH_HEADERS.includes(x))) return reply(403, 'preflight_not_allowed');
      headers['Access-Control-Allow-Methods'] = 'GET';
      headers['Access-Control-Allow-Headers'] = AUTH_HEADERS.join(', ');
      return new Response(null, { status: 204, headers });
    }
    if (new URL(req.url).searchParams.get('mode') === 'guest-discover') {
      // Credentials never downgrade to guest. All other routes retain JWT verification.
      if (req.headers.has('authorization')) return reply(400, 'invalid_search');
      let input;
      try { input = parseGuestSearch(new URL(req.url).searchParams); }
      catch { return reply(400, 'invalid_search'); }
      const release = admitGuest();
      if (!release) return reply(429, 'search_unavailable');
      try {
        // Never fall back to the member service: its cache/lease adapter writes DB state.
        const data = publicSearchResult(await guestDiscover(input));
        let badges = [];
        if (UUID.test(ownerId || '')) {
          try { badges = await usage(data.candidates.map(c => c.id), data.candidates); } catch { /* Unknown is not never visited. */ }
        }
        for (const candidate of data.candidates) {
          const badge = badges.find(b => b.id === candidate.id);
          if (badge?.used === true) candidate.haraken_usage = badge.revisited === true ? 'revisited' : 'used';
        }
        if(UUID.test(ownerId||'')&&data.center&&!data.needs_choice){
          try{data.candidates=mergeKnownStores(data.candidates,await knownStores(data.center,data.radius_m));}catch{/* External search remains available; no private errors returned. */}
        }
        if(data.center)data.candidates=withinSearch(data.candidates,data.center,data.radius_m);
        return Response.json(data, { status: 200, headers });
      } catch { return reply(503, 'search_unavailable'); }
      finally { release(); }
    }
    const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i
      .exec(req.headers.get('authorization') || '');
    if (!bearer) return reply(401, 'unauthorized');
    try {
      const identity = await verifyUser(bearer[1]);
      if (!UUID.test(identity?.user_id || '')) return reply(401, 'unauthorized');
      if (!UUID.test(ownerId || '')) return reply(503, 'owner_unavailable');
      if (identity.user_id !== ownerId) return reply(403, 'owner_only');
      if (new URL(req.url).searchParams.get('mode') === 'owner-check') return reply(200);
      if (new URL(req.url).searchParams.get('mode') === 'discover') {
        stage('discover_entered');
        let input;
        try { input = parseSearch(new URL(req.url).searchParams); }
        catch { stage('discover_failed'); return reply(400, 'invalid_search'); }
        stage('discover_params_ok');
        try { const response = Response.json(await discover(input), { status: 200, headers }); stage('discover_complete'); return response; }
        catch { stage('discover_failed'); return reply(503, 'search_unavailable'); }
      }
      // Verified identity is internal only. No query/body owner value is used.
      try {
        await runAuthenticated({
          userId: identity.user_id,
          withConnection: operation => database.withConnection(operation),
        });
      } catch {
        // No driver errors or callback values reach responses or logs.
        return reply(503, 'database_unavailable');
      }
      return reply(200);
    } catch {
      // Do not serialize provider errors, credentials, JWTs, or user information.
      return reply(503, 'auth_unavailable');
    }
  };
}
