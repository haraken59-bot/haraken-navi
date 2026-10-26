import {validPoint,distanceKm} from './places.js';
import {filterNearbyPhotoStores,photoNameKey} from './photo-store-candidates.js?v=20261022-photo500m';
export const OVERPASS_URL='https://overpass-api.de/api/interpreter';
const amenities='restaurant|cafe|fast_food|bar|pub|food_court|biergarten|ice_cream';
const text=value=>String(value??'').normalize('NFKC').trim().slice(0,300);
const valid=p=>validPoint(p)&&typeof p.latitude==='number'&&typeof p.longitude==='number'&&(p.latitude!==0||p.longitude!==0);
export function overpassQuery(point){
 if(!valid(point))throw Error('invalid_photo_gps');
 return `[out:json][timeout:20][maxsize:8388608];nwr["amenity"~"^(${amenities})$"](around:500,${point.latitude},${point.longitude});out body center;`;
}
export function osmCandidates(data,point,excluded={}){
 if(!valid(point)||!Array.isArray(data?.elements))throw Error('invalid_response');
 const seen=new Set(),rows=[];
 for(const e of data.elements){
  const t=e.tags||{},p=e.type==='node'?{latitude:e.lat,longitude:e.lon}:{latitude:e.center?.lat,longitude:e.center?.lon};
  if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<=0||!amenities.split('|').includes(t.amenity))continue;
  if(!valid(p)){const reason=e.type==='node'?'invalid_node_coordinates':'invalid_center_coordinates';excluded[reason]=(excluded[reason]||0)+1;continue;}
  if(['yes','true','1'].includes(t.disused)||['yes','true','1'].includes(t.abandoned)||t['disused:amenity']||t['abandoned:amenity']||t.closed==='yes')continue;
  const name=text(t['name:ja']||t.name);if(!name)continue;
  const distance=distanceKm(point,p)*1000,osm_id=`${e.type}/${e.id}`;
  if(distance>500+1e-7){excluded.outside_500m=(excluded.outside_500m||0)+1;continue;}if(seen.has(osm_id))continue;seen.add(osm_id);
  const aliases=[t.name,t['name:ja'],t.alt_name,t['alt_name:ja'],t.short_name,t.official_name].flatMap(v=>text(v).split(';')).filter(Boolean);
  const address=text(t['addr:full']||[t['addr:province'],t['addr:city'],t['addr:suburb'],t['addr:quarter'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' '));
  rows.push({name,aliases:[...new Set(aliases)],...p,address,distance_m:Math.round(distance),osm_id,source:'osm',sources:[{type:'osm',id:osm_id}],registration:'unregistered',representative:e.type!=='node'});
 }
 return rows.sort((a,b)=>a.distance_m-b.distance_m);
}
// Only identity or an unambiguous exact name AND exact position may collapse a card.
// Alias/nearby matches stay separate and require explicit user review.
export function mergePhotoStores(registered,external,point){
 const rows=filterNearbyPhotoStores(registered,point).map(r=>({...r,source:'supabase',sources:[{type:'supabase',id:r.id}],registration:'registered'}));
 const identical=(a,b)=>text(a.name)===text(b.name)&&Math.abs(a.latitude-b.latitude)<1e-7&&Math.abs(a.longitude-b.longitude)<1e-7&&(!a.address||!b.address||text(a.address)===text(b.address));
 for(const e of external){
  if(!valid(e)||distanceKm(point,e)*1000>500+1e-7)continue;
  const hits=rows.filter(r=>r.osm_id===e.osm_id||r.sources.some(s=>s.type==='osm'&&s.id===e.osm_id)||identical(r,e));
  if(hits.length===1){const r=hits[0];r.sources=[...r.sources,...e.sources.filter(s=>!r.sources.some(x=>x.type===s.type&&x.id===s.id))];r.aliases=[...new Set([...(r.aliases||[]),...e.aliases])];r.address=r.address||e.address;r.representative=Boolean(r.representative||e.representative);continue;}
  const similar=rows.filter(r=>distanceKm(r,e)*1000<=25&&[r.name,...(r.aliases||[])].some(n=>[e.name,...e.aliases].some(m=>photoNameKey(n)===photoNameKey(m))));
  if(hits.length||similar.length){for(const r of [...hits,...similar])r.review=true;rows.push({...e,review:true});}else rows.push({...e});
 }
 return rows.sort((a,b)=>a.distance_m-b.distance_m);
}
export function createOsmSearch({request=(...args)=>fetch(...args),now=()=>Date.now(),timeoutMs=25000}={}){
 const cache=new Map(),pending=new Map();let nextAllowed=0;
 return async point=>{
  const query=overpassQuery(point),key=JSON.stringify([point.latitude,point.longitude,500,amenities]),time=now();
  const saved=cache.get(key);if(saved&&saved.until>time)return {...structuredClone(saved.result),cached:true};
  if(pending.has(key))return pending.get(key);
  if(time<nextAllowed)return {status:'rate_limited',candidates:[],cached:false};
  nextAllowed=time+10000;
  const task=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let result;
   try{
    const response=await request(OVERPASS_URL,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString(),signal:controller.signal});
    if(!response.ok){result={status:response.status===429?'rate_limited':response.status===504?'timeout':'unavailable',candidates:[]};}
    else{const data=await response.json();if(data.remark){result={status:/timed out|timeout/i.test(data.remark)?'timeout':'unavailable',candidates:[]};}else{const excluded={};const candidates=osmCandidates(data,point,excluded);result={status:candidates.length?'ok':'empty',candidates,excluded};}}
   }catch{result={status:controller.signal.aborted?'timeout':'unavailable',candidates:[]};}finally{clearTimeout(timer);}
   const success=['ok','empty'].includes(result.status);if(!success)nextAllowed=Math.max(nextAllowed,now()+30000);
   cache.set(key,{until:now()+(success?300000:30000),result});while(cache.size>20)cache.delete(cache.keys().next().value);
   return {...structuredClone(result),cached:false};
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 };
}
export const searchPhotoOsm=createOsmSearch();
