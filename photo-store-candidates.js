import {validPoint,distanceKm} from './places.js';
// Name aliases are discovery hints only, never an identity decision.
export const photoNameKey=value=>String(value||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').replace(/萬/g,'万').toLowerCase();
export const photoNameMatches=(name,query)=>{const a=photoNameKey(name),b=photoNameKey(query);return !b||a.includes(b)||(a.length>=2&&b.includes(a));};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function filterNearbyPhotoStores(candidates,point){
 if(!validPoint(point)||(point.latitude===0&&point.longitude===0))return [];
 const unique=new Map();
 for(const c of Array.isArray(candidates)?candidates:[]){
  const id=[c?.store_id,c?.id].find(x=>typeof x==='string'&&uuid.test(x));
  if(!id||!validPoint(c)||(c.latitude===0&&c.longitude===0)||!c.name||c.closed||c.permanently_closed||c.is_test)continue;
  const meters=distanceKm(point,c)*1000;
  // Only sub-micrometre floating-point tolerance at the inclusive 500m boundary.
  if(!Number.isFinite(meters)||meters>500+1e-7||unique.has(id))continue;
  unique.set(id,{id,store_id:id,name:c.name,latitude:c.latitude,longitude:c.longitude,address:c.address||'',area:c.area||'',distance_m:Math.round(meters)});
 }
 return [...unique.values()].sort((a,b)=>a.distance_m-b.distance_m);
}
