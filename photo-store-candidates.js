import {validPoint,distanceKm} from './places.js';
export const photoNameKey=value=>String(value||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').toLowerCase();
export function filterNearbyPhotoStores(candidates,point,name=''){
 if(!validPoint(point)||(point.latitude===0&&point.longitude===0))return [];
 const unique=new Map();
 for(const c of Array.isArray(candidates)?candidates:[]){if(!c||!validPoint(c)||!c.name||c.closed||c.permanently_closed)continue;const k=photoNameKey(c.name)+'|'+c.latitude+'|'+c.longitude;if(!unique.has(k))unique.set(k,c);}
 const hint=String(name||'').normalize('NFKC').trim().slice(0,60),hintKey=photoNameKey(hint);
 return [...unique.values()].filter(c=>c&&typeof c.name==='string'&&c.name.trim()&&validPoint(c)&&(distanceKm(point,c)<=0.5||(hintKey&&photoNameKey(c.name).includes(hintKey)&&distanceKm(point,c)<=1))&&!c.closed&&!c.permanently_closed).sort((a,b)=>{const match=c=>hintKey&&photoNameKey(c.name).includes(hintKey)?0:1;return match(a)-match(b)||distanceKm(point,a)-distanceKm(point,b);}).slice(0,20).map(c=>({...(typeof c.store_id==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(c.store_id)?{store_id:c.store_id}:{}),...(typeof c.id==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(c.id)?{id:c.id}:{}),name:c.name,latitude:c.latitude,longitude:c.longitude,address:c.address||c.hotpepper?.address||'',distance_m:Math.round(distanceKm(point,c)*1000)}));
}
