import {validPoint,distanceKm} from './places.js';
export const photoNameKey=value=>String(value||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').toLowerCase();
export function filterNearbyPhotoStores(candidates,point,name=''){
 if(!validPoint(point)||(point.latitude===0&&point.longitude===0))return [];
 const hint=String(name||'').normalize('NFKC').trim().slice(0,60),hintKey=photoNameKey(hint);
 return (Array.isArray(candidates)?candidates:[]).filter(c=>c&&typeof c.name==='string'&&c.name.trim()&&validPoint(c)&&(distanceKm(point,c)<=0.5||(hintKey&&photoNameKey(c.name).includes(hintKey)&&distanceKm(point,c)<=1))&&!c.closed&&!c.permanently_closed).sort((a,b)=>{const match=c=>hintKey&&photoNameKey(c.name).includes(hintKey)?0:1;return match(a)-match(b)||distanceKm(point,a)-distanceKm(point,b);}).slice(0,20).map(c=>({name:c.name,latitude:c.latitude,longitude:c.longitude,address:c.address||c.hotpepper?.address||'',distance_m:Math.round(distanceKm(point,c)*1000)}));
}
