import {validOriginalPath} from './meal-photo.js';

// Read-only orphan audit. A candidate is never proof that deletion is safe:
// pending saves, partial history pages and delayed DB commits can still reference it.
export function auditOriginalReferences({owner,objects,meals,complete=false}){
 const references=new Set();
 for(const meal of meals||[]){
  for(const photo of meal.navi_metadata?.original_photos||[]){
   if(validOriginalPath(photo.path,owner,meal.id))references.add(photo.path);
  }
 }
 const candidates=[],invalid=[];
 for(const path of objects||[]){
  const parts=typeof path==='string'?path.split('/'):[];
  if(parts.length!==3||!validOriginalPath(path,owner,parts[1])){invalid.push(path);continue;}
  if(!references.has(path))candidates.push(path);
 }
 return {checked:(objects||[]).length,referenced:references.size,
  candidates:[],unverified:candidates,
  invalid,canDelete:false,reason:'候補は削除対象ではありません。保存途中の参照・全履歴・保留処理の照合が必要です。'};
}
