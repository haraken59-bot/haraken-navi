import { parseSearch } from './search-service.mjs';

// Public capability: external search only. No user identity, RPC or arbitrary operation.
const KEYS = new Set(['mode','area','region','latitude','longitude','lat','lng','gpsLatitude','gpsLongitude','placeIndex','direction','category','portion','budget','mealMode','hint']);
export function parseGuestSearch(params) {
  for (const key of params.keys()) if (!KEYS.has(key) || params.getAll(key).length !== 1) throw Error('invalid_search');
  if (params.has('mealMode') && !['eat','drink'].includes(params.get('mealMode'))) throw Error('invalid_search');
  return parseSearch(params);
}

const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k,value[k]]));
const point = value => pick(value,['latitude','longitude','label']);
export function publicSearchResult(value) {
  const result = pick(value,['radius_m','fetched_at','source','pending','degraded','truncated','warning','needs_choice','search_radii','search_terms']);
  if(value.center) result.center=point(value.center);
  if(value.places) result.places=value.places.slice(0,3).map(point);
  result.candidates=(value.candidates||[]).filter(c=>c.source_kind==='hotpepper'&&c.discovered===true).slice(0,100).map(c=>({
    ...pick(c,['id','hotpepper_id','name','latitude','longitude','address','kind','mode','tags','dish','meal_evidence','source_kind','sources','source','source_url','hours','area','observed_at','confidence']),
    price:null,satisfaction:null,visited:false,is_new:true,discovered:true,
    hotpepper:pick(c.hotpepper,['id','genre','sub_genre','budget_name','budget_average','open','close','lunch','free_drink','free_food','shochu_rich','sake_rich','url','fetched_at']),
  }));
  return result;
}

// Bounded per-isolate load protection; shared provider leases/pacing remain authoritative.
export function guestAdmission(now = () => Date.now()) {
  let started = 0, count = 0, running = 0;
  return () => {
    const time = now();
    if (time - started >= 60000) { started = time; count = 0; }
    if (running >= 2 || count >= 30) return null;
    count++; running++;
    return () => { running--; };
  };
}
