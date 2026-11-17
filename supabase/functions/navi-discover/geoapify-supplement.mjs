// Geoapify supplement for navi-discover (NAVI-23).
//
// Integrated final candidate (2026-11-13): ChatGPT v04 (shared time budget,
// credential-scoped in-flight sharing, input validation, capped write-behind
// cache) merged with the anko candidate's additions ((0,0) coordinate
// exclusion). Reviewed against both test suites; see the v04 diff review.
//
// Purpose: when a search has a food hint but the Hot Pepper pool contains
// fewer than `threshold` dish-matching candidates, supplement the pool with
// one Geoapify Places query and merge the results. Hot Pepper stays the
// primary source. Any Geoapify failure leaves the Hot Pepper result intact.
//
// This module is dependency-injected (fetch, cache, matcher) so it can be
// wired into the production function without changes, and unit-tested in
// plain Node. The API key is only ever taken from the caller (server-side
// secret) and is never logged or returned.

const EARTH_R = 6371000;
const DEFAULT_THRESHOLD = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 1800 * 1000; // 30 minutes, same policy as Hot Pepper

const CUISINE_LABELS = {
  udon: 'うどん', ramen: 'ラーメン', soba: 'そば', noodle: '麺類', noodles: '麺類',
  sushi: '寿司', yakiniku: '焼肉', yakitori: '焼き鳥', curry: 'カレー',
  chinese: '中華', italian: 'イタリアン', french: 'フレンチ', japanese: '和食',
  korean: '韓国料理', thai: 'タイ料理', indian: 'インド料理', pizza: 'ピザ',
  burger: 'ハンバーガー', cafe: 'カフェ', bakery: 'ベーカリー',
};
const NOODLE_LABELS = new Set(['うどん', 'ラーメン', 'そば', '麺類']);

export function normalizeStoreName(name) {
  // NFKC + whitespace / nakaguro removal. The long-vowel mark "ー" is part
  // of a shop's name and is never stripped.
  return String(name || '').normalize('NFKC').replace(/[\s　・･]/g, '').toLowerCase();
}

export function distanceM(a, b) {
  const rad = (x) => x * Math.PI / 180;
  const p1 = rad(a.latitude), p2 = rad(b.latitude);
  const dp = rad(b.latitude - a.latitude), dl = rad(b.longitude - a.longitude);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function shouldSupplement({hasHint, matchCount, threshold = DEFAULT_THRESHOLD}) {
  return Boolean(hasHint) && Number.isFinite(matchCount) && matchCount < threshold;
}

function cuisineTokens(rawCuisine) {
  return String(rawCuisine || '').split(/[;,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Convert one Geoapify Places feature into the normalized candidate shape
// used by navi-discover (same conventions as the Hot Pepper normalizer:
// dish text is genre + "（具体的な料理は要確認）", missing hours stay empty
// and are treated as "to be confirmed" downstream, never as closed).
export function featureToCandidate(feature) {
  const p = feature?.properties || {};
  const [lon, lat] = feature?.geometry?.coordinates || [];
  const name = p.name || '';
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || (lat===0 && lon===0)) return null;
  const categories = p.categories || [];
  const raw = p.datasource?.raw || {};
  const tokens = cuisineTokens(raw.cuisine);
  const labels = tokens.map((t) => CUISINE_LABELS[t]).filter(Boolean);
  const isNoodle = categories.some((c) => c.endsWith('.noodle')) || labels.some((l) => NOODLE_LABELS.has(l));
  const tags = [...new Set([...(isNoodle ? ['麺'] : []), ...labels])];
  const genre = isNoodle ? '麺類' : (labels[0] || '飲食店');
  const mode = categories.some((c) => c === 'catering.pub' || c === 'catering.bar') ? 'both' : 'eat';
  const osmId = raw.osm_id != null ? String(raw.osm_id) : '';
  return {
    kind: 'store',
    id: 'geoapify:' + (p.place_id || osmId || `${lat},${lon}`),
    source_kind: 'geoapify',
    sources: ['geoapify'],
    source: 'Geoapify',
    source_url: null,
    hours: raw.opening_hours || null,
    confidence: '掲載情報・営業時間は要確認',
    discovered: true,
    name,
    latitude: lat,
    longitude: lon,
    address: p.formatted || '',
    genre,
    dish: genre + '（具体的な料理は要確認）',
    cuisine: tokens.join(','),
    meal_evidence: labels.join(' '),
    tags,
    mode,
    open: raw.opening_hours || '',
  };
}

// Merge Geoapify candidates into the Hot Pepper pool. A Geoapify candidate
// is dropped only when a pooled candidate has the same normalized name AND
// is within maxDistanceM: Hot Pepper wins. Distance alone never merges
// different names.
export function mergeSupplement(base, extra, {maxDistanceM = 50} = {}) {
  const merged = [...base];
  let added = 0, duplicates = 0;
  for (const c of extra) {
    const dup = merged.some((o) =>
      normalizeStoreName(o.name) === normalizeStoreName(c.name) &&
      Number.isFinite(o.latitude) && Number.isFinite(o.longitude) &&
      distanceM(o, c) <= maxDistanceM);
    if (dup) { duplicates++; continue; }
    merged.push(c); added++;
  }
  return {candidates: merged, added, duplicates};
}

export function geoapifyCacheKey({latitude, longitude, radius_m}) {
  return 'v1:geoapify:' + JSON.stringify([['lat', String(latitude)], ['lng', String(longitude)], ['radius_m', radius_m], ['categories', 'catering']]);
}

// Shared in-flight calls are private to this module instance; settled entries are removed.
const inFlight = new Map();
function bounded(promise, ms) {
  if (ms <= 0) return Promise.reject(Error('geoapify_budget_exhausted'));
  let timer;
  return Promise.race([
    Promise.resolve().then(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('geoapify_timeout')), ms); }),
  ]).finally(() => clearTimeout(timer));
}
async function fetchGeoapifyFeatures({center, radius_m, apiKey, fetchImpl, timeoutMs}) {
  const q = new URLSearchParams({
    categories: 'catering',
    filter: `circle:${center.longitude},${center.latitude},${radius_m}`,
    limit: '500', lang: 'ja', apiKey,
  });
  const controller = new AbortController();
  let timer;
  try {
    timer = setTimeout(() => controller.abort(), timeoutMs);
    return await bounded(async () => {
      const res = await fetchImpl(`https://api.geoapify.com/v2/places?${q}`, {signal:controller.signal});
      if (!res || !res.ok) throw Error('geoapify_http_error');
      const data = await res.json();
      return Array.isArray(data?.features) ? data.features : [];
    }, timeoutMs);
  } finally { clearTimeout(timer); controller.abort(); }
}

const defaultExactMatch = (term) => (c) =>
  [c.name, c.dish, c.meal_evidence, ...(c.tags || [])].some((x) => String(x || '').includes(term));

// Orchestrator. Never throws: the whole supplement (trigger counting,
// cache, fetch, conversion, merge) is failure-isolated, and on any error
// it returns the original candidates with supplemented=false, leaving the
// Hot Pepper result untouched.
// - exactTerm: the dish the user actually asked for (e.g. "うどん"). The
//   trigger counts evidence for this term only; related family terms are
//   used by the caller's search expansion, never for this decision.
// - exactMatchFn: optional matcher compatible with the caller's existing
//   exact-dish predicate; a default evidence matcher is used otherwise.
// - cache: optional Map-like {get,set}; both may be async. Cache failures
//   are ignored (a failed read is a miss, a failed write is dropped).
export async function supplementCandidates({
  candidates, exactTerm = '', exactMatchFn, center, radius_m,
  apiKey, fetchImpl, cache, now = Date.now,
  threshold = DEFAULT_THRESHOLD, timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const base = {candidates, supplemented: false, calls: 0};
  if (!center || !apiKey || !fetchImpl || !exactTerm || !Array.isArray(candidates) ||
      !Number.isFinite(center.latitude) || Math.abs(center.latitude)>90 ||
      !Number.isFinite(center.longitude) || Math.abs(center.longitude)>180 ||
      !Number.isFinite(radius_m) || radius_m<=0 || !Number.isFinite(timeoutMs) || timeoutMs<=0) return base;
  const started = now();
  const remaining = () => Math.max(0, timeoutMs - (now() - started));
  let calls = 0;
  try {
    const match = exactMatchFn || defaultExactMatch(exactTerm);
    const matchCount = candidates.filter(match).length;
    if (!shouldSupplement({hasHint: true, matchCount, threshold})) return base;
    const key = geoapifyCacheKey({latitude:center.latitude, longitude:center.longitude, radius_m});
    let features = null;
    if (cache) {
      try {
        const hit = await bounded(() => cache.get(key), remaining());
        if (hit && Array.isArray(hit.features) && now()-hit.fetched_at < CACHE_TTL_MS) features=hit.features;
      } catch { /* cache failure/timeout: fail open */ }
    }
    if (!features) {
      if (remaining()<=0) return base;
      // Distinct API credentials must never share a request. The secret stays in memory.
      const flightKey = JSON.stringify([key, apiKey]);
      let job = inFlight.get(flightKey);
      if (!job) {
        calls=1;
        job=fetchGeoapifyFeatures({center,radius_m,apiKey,fetchImpl,timeoutMs:remaining()});
        inFlight.set(flightKey,job);
        job.finally(() => { if(inFlight.get(flightKey)===job) inFlight.delete(flightKey); }).catch(()=>{});
      }
      features = await bounded(() => job, remaining());
      // Cache writes are best-effort and must not delay returning valid results.
      if (cache && remaining()>0) {
        void bounded(() => cache.set(key,{fetched_at:now(),features}), Math.min(100,remaining())).catch(() => {});
      }
    }
    const extra = features.map(featureToCandidate).filter(Boolean)
      .filter(c => distanceM(center,c)<=radius_m);
    const {candidates:merged,added,duplicates}=mergeSupplement(candidates,extra);
    return {candidates:merged,supplemented:true,calls,added,duplicates};
  } catch { return {...base,calls,error:'geoapify_failed'}; }
}
