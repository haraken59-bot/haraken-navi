import {prepare,createRow,thumbnail} from './importer/photos.js';
export const PHOTO_BUCKET='navi-meal-originals';
export const MAX_PHOTO_BYTES=20*1024*1024;
export const MAX_MEAL_BYTES=50*1024*1024;
export async function prepareMealPhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPEG・PNG・WebPを選んでください。原画を変換せず保存します。');
 if(file.size>MAX_PHOTO_BYTES)throw Error('原画は1枚20MBまでです。写真を選び直してください。');
 const row=await prepare(file,createRow(file),{keepOriginal:true});
 try{
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{if(bitmap.width*bitmap.height>50_000_000)throw Error('5000万画素以下の写真を選んでください。');row.original_info={width:bitmap.width,height:bitmap.height,size:file.size,type:file.type,orientation:row.orientation};}finally{bitmap.close();}
  try{row.thumbnail=await thumbnail(file);}catch{row.thumbnail=null;row.preview_failed=true;}
  return row;
 }finally{URL.revokeObjectURL(row.url);row.url=null;row.blob=null;}
}
export function originalPath(owner,mealId,p){
 if(![owner,mealId,p.id].every(x=>/^[a-f0-9-]{36}$/i.test(x))||!/^[a-f0-9]{64}$/.test(p.fingerprint))throw Error('写真IDが不正です');
 return `${owner}/${mealId}/${p.id}_${p.fingerprint}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[p.file.type]}`;
}
export function validOriginalPath(path,owner,mealId){return typeof path==='string'&&path.startsWith(`${owner}/${mealId}/`)&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}_[a-f0-9]{64}\.(jpg|png|webp)$/i.test(path);}
export async function saveMealWithPhotos(client,meal,photos){
 const s=await client.fresh(),owner=s.user.id;
 if(photos.reduce((n,p)=>n+p.file.size,0)>MAX_MEAL_BYTES)throw Error('写真は1食合計50MBまでです。');
 const attached=photos.map(p=>({image_id:p.id,path:originalPath(owner,meal.id,p),...p.original_info,sha256:p.fingerprint}));
 const saved={...meal,navi_metadata:{...meal.navi_metadata,original_photos:attached}};
 // Deterministic paths make retry safe; never overwrite a different object.
 try{for(let i=0;i<photos.length;i++)await client.uploadOriginal(attached[i].path,photos[i].file,photos[i].fingerprint);}
 catch(e){try{await client.removePendingOriginals(attached.map(x=>x.path));}catch{e.message+=' 未完了の原画の削除を確認できません。入力を変えず再試行してください。';}throw e;}
 if((await client.fresh()).user.id!==owner)throw Error('アカウントが変わりました。保存を停止しました。');
 try{await client.mealRpc('save_navi_meal',{meal:saved});}
 catch(e){
  if(e.saveRejected){try{await client.removePendingOriginals(attached.map(x=>x.path));}catch{e.message+=' 未完了原画の削除を確認できません。';}throw e;}
  // Timeout may mean the DB committed. Do not delete a possibly attached original.
  e.message+=' 原画は再試行用に保持しています。入力を変えずに再試行してください。';throw e;
 }
 return saved;
}
export async function downloadMealPhoto(client,meal,image){
 const s=await client.fresh(),original=meal.navi_metadata?.original_photos?.find(p=>p.image_id===image.id);
 if(original){if(!validOriginalPath(original.path,s.user.id,meal.id))throw Error('写真の所有者を確認できません');return {blob:await client.readOriginal(original.path),name:image.file_name||'photo.jpg',original:true};}
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.thumbnail||''))throw Error('保存済み画像がありません');
 const bytes=Uint8Array.from(atob(image.thumbnail.split(',')[1]),c=>c.charCodeAt(0));
 return {blob:new Blob([bytes],{type:'image/jpeg'}),name:'legacy-preview.jpg',original:false};
}
