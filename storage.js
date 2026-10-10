export const emptyState=()=>({version:1,candidates:[],records:[],decisions:[],events:[]});
export function readState(storage,owner='guest'){const raw=storage.getItem('haraken-navi-v1:'+owner);if(!raw)return emptyState();const v=JSON.parse(raw);if(v.version!==1||!['candidates','records','decisions','events'].every(k=>Array.isArray(v[k])))throw Error('保存データの形式が異なります。上書きせず停止しました。');return v;}
export function isStorageQuotaError(e){return e?.name==='QuotaExceededError'||e?.name==='NS_ERROR_DOM_QUOTA_REACHED';}
export function writeState(storage,owner,state){
 const key='haraken-navi-v1:'+owner,value=JSON.stringify(state);
 try{storage.setItem(key,value);}catch(e){
  if(!isStorageQuotaError(e))throw e;
  // Only disposable search results are evicted. Records, photos and sessions remain intact.
  storage.removeItem('haraken-discovery-cache-v1');
  try{storage.setItem(key,value);}catch(retry){
   if(isStorageQuotaError(retry))throw Object.assign(Error('端末の保存容量が不足しています。この操作は保存できていません。既存の記録は残っています。'),{name:'QuotaExceededError'});
   throw retry;
  }
 }
}
export function learningRecords(records){return records.filter(r=>r.is_test===false&&r.use_for_learning!==false&&r.exclude_from_learning!==true);}
export function validateRecord(r){if(!r.store_name?.trim())throw Error('実際の店・行動を入力してください。');if(!r.dish_name?.trim())throw Error('料理・内容を入力してください。');if(!Number.isInteger(r.amount_jpy)||r.amount_jpy<0)throw Error('金額は0円以上の整数で入力してください。');if(!Number.isInteger(r.satisfaction)||r.satisfaction<1||r.satisfaction>5)throw Error('満足度は1〜5を選んでください。');return r;}
