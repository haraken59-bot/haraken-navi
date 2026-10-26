const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=()=>Error('保存待ち記録を端末に保持できません。送信せず停止しました。');
// Private browser storage, never an auth-token store. Keep originals until save is confirmed.
export function createMealSaveJournal(factory=globalThis.indexedDB){
 let opening;
 function open(){if(!factory)return Promise.reject(unavailable());if(!opening)opening=new Promise((resolve,reject)=>{const r=factory.open('haraken-navi-save-journal',1);r.onupgradeneeded=()=>r.result.createObjectStore('pending',{keyPath:'owner'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(unavailable());r.onblocked=()=>reject(unavailable());}).catch(e=>{opening=null;throw e;});return opening;}
 async function operation(owner,mode,change){
  if(!UUID.test(owner||''))throw unavailable();const db=await open();
  return new Promise((resolve,reject)=>{const tx=db.transaction('pending',mode),store=tx.objectStore('pending');let result;const request=store.get(owner);
   request.onsuccess=()=>{try{const old=request.result;if(old&&(old.owner!==owner||!UUID.test(old.meal?.id||'')||!Array.isArray(old.photos)))throw unavailable();result=change(store,old||null);}catch{tx.abort();}};
   tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(unavailable());
  });
 }
 return {
  read:owner=>operation(owner,'readonly',(_s,old)=>old),
  begin:(owner,meal,photos)=>operation(owner,'readwrite',(s,old)=>{if(old)return old;if(!UUID.test(meal?.id||'')||!Array.isArray(photos))throw unavailable();const value={owner,meal,photos};s.add(value);return value;}),
  clear:(owner,id)=>operation(owner,'readwrite',(s,old)=>{if(old&&old.meal.id!==id)throw unavailable();if(old)s.delete(owner);}),
 };
}
