import {distanceKm,normalizeName,officialStoreName} from '../../../app/places.js';
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');
export function createKnownStoreReader(database,ownerId){
 return async(center,radius)=>{
  if(!uuid(ownerId)||![center?.latitude,center?.longitude,radius].every(Number.isFinite)||radius<=0||radius>3000)return [];
  let rows=[];
  await database.withConnection(async client=>{rows=(await client.query('SELECT store_id,name,latitude,longitude,used,revisited FROM navi_internal.guest_known_stores($1::uuid,$2::double precision,$3::double precision,$4::integer)',[ownerId,center.latitude,center.longitude,Math.floor(radius)])).rows;});
  return rows.filter(r=>uuid(r.store_id)&&r.used===true&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=200&&[r.latitude,r.longitude].every(Number.isFinite)&&Math.abs(r.latitude)<=90&&Math.abs(r.longitude)<=180&&distanceKm(center,r)*1000<=radius).slice(0,50).map(r=>({id:'known:'+r.store_id,store_id:r.store_id,name:officialStoreName(r.name),latitude:r.latitude,longitude:r.longitude,kind:'store',mode:'both',tags:[],dish:'料理・営業状況は要確認',discovered:true,source_kind:'known_store',source:'ハラケン既知店舗',confidence:'店舗所在地確認済み・現在の営業は要確認',haraken_usage:r.revisited===true?'revisited':'used'}));
 };
}
// Identity alone must not merge different branches. Ambiguous links remain unlinked.
export function mergeKnownStores(external,known){
 const matches=(a,b)=>a.store_id&&a.store_id===b.store_id||a.id===b.id||a.hotpepper_id&&a.hotpepper_id===b.hotpepper_id||normalizeName(a.name)===normalizeName(b.name)&&distanceKm(a,b)*1000<=25;
 const links=known.map(k=>external.filter(e=>matches(k,e)));
 const result=external.map(e=>({...e}));
 for(let i=0;i<known.length;i++){
  const k=known[i],found=links[i];
  if(found.length===1&&links.filter(list=>list.includes(found[0])).length===1){
   const e=result.find(c=>c.id===found[0].id);
   if(e.closed===true||e.permanently_closed===true)continue;
   e.store_id=k.store_id;e.haraken_usage=k.haraken_usage;
  }else if(!found.length&&!result.some(e=>matches(k,e)))result.push(k);
 }
 return result;
}
