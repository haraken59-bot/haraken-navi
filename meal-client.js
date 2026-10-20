import {ReadOnlyClient} from './api.js';
import {validPoint,distanceKm} from './places.js';
import {PHOTO_BUCKET} from './meal-photo.js';
import {filterNearbyPhotoStores} from './photo-store-candidates.js';
export const canRestoreMealLearning=row=>row?.navi_metadata?.is_test===true&&row?.navi_metadata?.exclude_from_learning===true;
export class MealClient extends ReadOnlyClient{
 async mealDeleteRequest(action,row){
  const s=await this.fresh();
  const body={action};
  if(row){if(!/^[a-f0-9-]{36}$/i.test(row.id)||!Number.isInteger(row.revision))throw Error('履歴を再取得してください。');body.meal_id=row.id;body.revision=row.revision;}
  try{
   const r=await this.request(this.config.url+'/functions/v1/navi-meal-delete',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
   if(!r.ok)throw Error('unconfirmed');
   const result=await r.json();if(this.session()?.user?.id!==s.user.id)throw Error('changed');return result;
  }catch{throw Error('削除の完了を確認できませんでした。履歴を再取得してください。写真削除が未完了の場合は再試行できます。');}
 }
 deleteMeal(row){return this.mealDeleteRequest('delete',row);}
 resumeMealDeletions(){return this.mealDeleteRequest('resume');}
 async restoreMealLearning(row){
  if(!canRestoreMealLearning(row)||!/^[a-f0-9-]{36}$/i.test(row.id)||!Number.isInteger(row.revision))throw Error('履歴を再取得してから操作してください。');
  try{const session=await this.fresh();return await this.send('/rest/v1/rpc/restore_navi_meal_learning',{mid:row.id,expected_revision:row.revision},session.access_token);}
  catch{throw Error('学習対象への変更を確認できませんでした。履歴を再取得してください。');}
 }
 async originalExists(path){
  const s=await this.fresh();
  if(!path.startsWith(s.user.id+'/')||path.includes('..'))throw Error('写真の所有者不正');
  const split=path.lastIndexOf('/'),name=path.slice(split+1);
  const rows=await this.send('/storage/v1/object/list/'+PHOTO_BUCKET,{prefix:path.slice(0,split),search:name,limit:100,offset:0},s.access_token);
  if(!Array.isArray(rows)||rows.some(r=>typeof r.name!=='string'))throw Error('Storage一覧を確認できません');
  return rows.some(r=>r.name===name);
 }
 async removePendingOriginals(paths){const s=await this.fresh();if(paths.some(p=>!p.startsWith(s.user.id+'/')||p.includes('..')))throw Error('写真の所有者不正');return this.send('/storage/v1/object/'+PHOTO_BUCKET,{prefixes:paths},s.access_token,'DELETE');}
 async readOriginal(path){const s=await this.fresh();if(!path.startsWith(s.user.id+'/')||path.includes('..'))throw Error('写真の所有者不正');const r=await this.request(this.config.url+'/storage/v1/object/authenticated/'+PHOTO_BUCKET+'/'+path,{cache:'no-store',headers:{apikey:this.config.publishableKey,Authorization:'Bearer '+s.access_token},signal:AbortSignal.timeout(60000)});if(!r.ok){const body=await r.json().catch(()=>({}));const e=Error('原画を取得できません（HTTP '+r.status+'）');e.status=r.status;e.notFound=r.status===404||body.error==='not_found'||body.code==='NoSuchKey'||body.message==='Object not found';throw e;}return r.blob();}
 async uploadOriginal(path,file,sha){const s=await this.fresh();if(!path.startsWith(s.user.id+'/')||path.includes('..'))throw Error('写真の所有者不正');const r=await this.request(this.config.url+'/storage/v1/object/'+PHOTO_BUCKET+'/'+path,{method:'POST',headers:{apikey:this.config.publishableKey,Authorization:'Bearer '+s.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file,signal:AbortSignal.timeout(120000)});if(!r.ok){const error=await r.json().catch(()=>({}));if(r.status===409||error.error==='Duplicate'||String(error.message).includes('already exists')){const old=await this.readOriginal(path);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await old.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash===sha)return;}throw Error('原画保存に失敗しました（HTTP '+r.status+'）。入力を変えずに再試行してください。');}}
 async mealRpc(name,args,expectedOwner=null){
  if(!['save_navi_meal','exclude_navi_meal'].includes(name))throw Error('未対応の食事操作です。');
  const s=await this.fresh();
  if(expectedOwner&&s.user?.id!==expectedOwner)throw Error('ログイン状態が変わりました。');
  const r=await this.request(this.config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:this.config.publishableKey,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(25000)});
  if(!r.ok){const e=await r.json().catch(()=>({}));if(e.code==='PGRST202'||e.code==='42703')throw Error('食事統合用のDB更新が未適用です。入力を残して停止しました。');if(e.code==='23505'||e.message?.includes('NAVI_DUPLICATE'))throw Object.assign(Error('同じ写真または同じ時間帯・店舗の記録があります。保存済み履歴を確認してください。'),{saveRejected:true});throw Error('保存を確認できませんでした。入力を変えずに再試行してください（HTTP '+r.status+'）。');}
  return r.status===204?null:r.json();
 }
 async editMeal(row,patch){
  if(!/^[a-f0-9-]{36}$/i.test(row.id)||!Number.isInteger(row.revision))throw Error('履歴を再取得してから編集してください。');
  const allowed=['eaten_at','store_id','unlinked_store_name','dish_name','comment','amount_jpy','satisfaction'];
  if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('未対応の編集項目です。');
  for(const [key,min,max] of [['amount_jpy',0,2147483647],['satisfaction',1,5]]){
   if(key in patch && patch[key]!==null && (!Number.isInteger(patch[key]) || patch[key]<min || patch[key]>max))throw Error('金額または満足度が正しくありません。');
  }
  const session=await this.fresh();
  try{return await this.send('/rest/v1/rpc/edit_meal_details',{meal_id:row.id,expected_revision:row.revision,patch},session.access_token);}catch{throw Error('編集を保存できませんでした。履歴を再取得して確認してください。');}
 }
 async savedMealExists(id,owner){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('保存待ちIDが不正です。');
  const s=await this.fresh();if(s.user?.id!==owner)throw Error('ログイン状態が変わりました。');
  const rows=await this.send('/rest/v1/meals?select=id&id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(owner),undefined,s.access_token,'GET');
  if(this.session()?.user?.id!==owner||!Array.isArray(rows)||rows.some(r=>r.id!==id))throw Error('保存結果を確認できません。');
  return rows.length===1;
 }
 async mealRows(offset=0){const s=await this.fresh();return this.send('/rest/v1/meals?select=id,navi_metadata&order=id&limit=100&offset='+offset,undefined,s.access_token,'GET');}
 async historyPage(offset=0){
  const history=await this.rpc('get_meal_history',{page_size:100,page_offset:offset});
  const ids=history.records.map(r=>r.id);if(!ids.length)return history.records;
  const s=await this.fresh();const extras=await this.send('/rest/v1/meals?select=id,navi_metadata&id=in.('+ids.join(',')+')',undefined,s.access_token,'GET');
  const byId=new Map(extras.map(r=>[r.id,r.navi_metadata||{}]));
  return history.records.map(r=>({...r,navi_metadata:byId.get(r.id)||{},is_test:byId.get(r.id)?.is_test===true,exclude_from_learning:byId.get(r.id)?.exclude_from_learning===true}));
 }
 async mealPhotos(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('記録ID不正');const s=await this.fresh();return this.send('/rest/v1/meal_images?select=id,thumbnail,file_name,taken_at&meal_id=eq.'+id,undefined,s.access_token,'GET');}
 async nearbyPhotoStores(point,name=''){
  if(!validPoint(point)||(point.latitude===0&&point.longitude===0))throw Error('写真GPSが正しくありません。');
  const session=await this.fresh(),url=new URL(this.config.url+'/functions/v1/navi-discover');
  const hint=String(name||'').normalize('NFKC').trim().slice(0,60);
  for(const [k,v] of Object.entries({mode:'discover',latitude:point.latitude,longitude:point.longitude,direction:'near',preference:'おまかせ',...(hint?{hint}:{})}))url.searchParams.set(k,String(v));
  const response=await this.request(url,{headers:{Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('写真周辺の店舗を取得できません。');
  const data=await response.json();if(this.session()?.user?.id!==session.user.id)throw Error('ログイン状態が変わりました。');
  return filterNearbyPhotoStores(data.candidates,point,hint);
 }
 async confirmStore(candidate){
  await this.verifyNaviOwner();const session=await this.fresh();
  const id=await this.send('/rest/v1/rpc/confirm_navi_store',{p_name:candidate.name,p_latitude:candidate.latitude,p_longitude:candidate.longitude,p_confirmed:true},session.access_token);
  if(this.session()?.user?.id!==session.user.id)throw Error('ログイン状態が変わりました。');return id;
 }
 async stores(){const s=await this.fresh();return this.send('/rest/v1/stores?select=id,name,area,latitude,longitude&is_test=eq.false&order=name&limit=1000',undefined,s.access_token,'GET');}
 async context(){const value=await super.context();try{value.history={ok:true,data:{schema_version:1,records:(await this.historyPage()).filter(r=>!(value.stores?.data||[]).some(s=>s.is_test&&s.id===r.store_id))}};}catch{value.history={ok:false,error:'共通履歴の追加情報を取得できません。DB更新または接続を確認してください。'};}return value;}
}
