import {saveMealWithPhotos,MAX_MEAL_BYTES,MAX_PHOTO_BYTES,originalPath} from './meal-photo.js';
export async function saveMealRecoverably({client,journal,owner,meal,photos,isCurrent,approveRetry=()=>false}){
 const check=()=>{if(!isCurrent()||client.session()?.user?.id!==owner)throw Error('アカウントが変わりました。前の本人で保存結果を確認してください。');};
 check();const old=await journal.read(owner);check();
 if(!old){if(!Array.isArray(photos)||photos.length>5||photos.some(p=>!p.file||!Number.isFinite(p.file.size)||p.file.size>MAX_PHOTO_BYTES)||photos.reduce((n,p)=>n+p.file.size,0)>MAX_MEAL_BYTES)throw Error('写真の枚数または容量が上限を超えています。送信していません。');for(const p of photos)originalPath(owner,meal.id,p);}
 const entry=old||await journal.begin(owner,meal,photos);check();
 if(old||entry.meal.id!==meal.id){
  const exists=await client.savedMealExists(entry.meal.id,owner);check();
  if(exists){await journal.clear(owner,entry.meal.id);check();return {meal:entry.meal,alreadySaved:true,recovered:true};}
  // A missing row is not proof the previous request failed. Replay the exact identity only.
  if(!await approveRetry()){check();throw Error('未確認の保存を保持しています。新しい記録は送信していません。');}check();
 }
 await saveMealWithPhotos(client,entry.meal,entry.photos,owner);check();
 await journal.clear(owner,entry.meal.id);check();return {meal:entry.meal,alreadySaved:false,recovered:!!old||entry.meal.id!==meal.id};
}
