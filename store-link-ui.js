import {validPoint,distanceKm} from './places.js';
import {filterNearbyPhotoStores,photoNameKey,photoNameMatches} from './photo-store-candidates.js?v=20261022-photo500m';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function storeNameKey(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\u3000・･\-ー_()（）]/g,'').replace(/^(?:やきとり|焼き鳥|焼鳥)(?=.)/,'焼鳥');}
export function matchingStores(rows,query){const key=storeNameKey(query);if(!key)return rows;return rows.filter(r=>photoNameMatches(storeNameKey(r.name),key));}
export function storeCandidateRank(row,query,referenceAddress=''){
 const name=storeNameKey(row.name),wanted=storeNameKey(query);
 const address=storeNameKey(row.address||row.area),reference=storeNameKey(referenceAddress);
 const exact=Boolean(wanted)&&name===wanted,partial=Boolean(wanted)&&photoNameMatches(name,wanted);
 const addressMatch=Boolean(reference&&address)&&(address===reference||address.includes(reference)||reference.includes(address));
 const distance=Number.isFinite(row.distance_m)?row.distance_m:Infinity;
 return {exact,partial,addressMatch,distance};
}
export function visibleStoreRows(rows,query,referenceAddress=''){
 const wanted=storeNameKey(query);
 return rows.map((r,i)=>({r,i,rank:storeCandidateRank(r,query,referenceAddress)}))
 .filter(({rank})=>!wanted||rank.partial)
 .sort((a,b)=>Number(b.rank.exact)-Number(a.rank.exact)||Number(b.rank.addressMatch)-Number(a.rank.addressMatch)||a.rank.distance-b.rank.distance||a.i-b.i);
}
export function storeListStatus(rows,query){if(!rows.length)return '登録店舗がありません。店舗ID未設定でも保存できます。';if(!storeNameKey(query))return '登録店舗をすべて表示しています。店舗を選び、確認してください。';return visibleStoreRows(rows,query).length?'店名に一致する登録店舗を表示しています。':'登録店舗に店名一致がありません。入力を消すと全店舗を表示します。';}
export function photoPoint(metadata){return [metadata?.photo_location,...(metadata?.photo_locations||[]).map(x=>x.location)].find(p=>validPoint(p)&&(p.latitude!==0||p.longitude!==0))||null;}
export function verifiedManualStore(name,latitude,longitude,photo){
 const lat=String(latitude??'').trim(),lng=String(longitude??'').trim();
 if(!String(name||'').trim()||!/^[-+]?\d+(?:\.\d+)?$/.test(lat)||!/^[-+]?\d+(?:\.\d+)?$/.test(lng))return null;
 const candidate={name:String(name).trim().slice(0,120),latitude:Number(lat),longitude:Number(lng)};
 if(!validPoint(candidate)||(candidate.latitude===0&&candidate.longitude===0))return null;
 if(validPoint(photo)&&Math.abs(candidate.latitude-photo.latitude)<1e-8&&Math.abs(candidate.longitude-photo.longitude)<1e-8)return null;
 return candidate;
}
const storeUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function linkedStoreId(candidate){
 return [candidate?.store_id,candidate?.id].find(id=>typeof id==='string'&&storeUuid.test(id))||null;
}
export async function resolveStoreSelection(client,candidate,isCurrent=()=>true){
 if(!isCurrent())throw Error('ログイン状態が変わりました。');
 const existing=linkedStoreId(candidate);
 if(existing)return existing;
 // Reuse a uniquely matching registered store before any new registration.
 const stores=await client.stores();
 if(!isCurrent())throw Error('ログイン状態が変わりました。');
 const found=registrationMatch(stores,candidate);
 if(found)return found;
 return client.confirmStore(candidate);
}
export function potentialStoreMatches(stores,candidate){
 const address=v=>String(v||'').normalize('NFKC').replace(/[\sー－]/g,'');
 return stores.filter(s=>photoNameMatches(storeNameKey(s.name),storeNameKey(candidate.name))||
  (s.address&&candidate.address&&address(s.address)===address(candidate.address))||
  (validPoint(s)&&validPoint(candidate)&&distanceKm(s,candidate)*1000<=25));
}
export function registrationMatch(stores,candidate){
 const exact=stores.filter(s=>sameStoreLocation(s,candidate));
 const possible=potentialStoreMatches(stores,candidate);
 if(exact.length===1&&possible.length===1)return exact[0].id;
 if(possible.length)throw Object.assign(Error('同名・類似の登録店舗があります。場所を確認してから紐付けしてください。複数候補は自動統合しません。'),{storeCandidates:possible});
 return null;
}
export function sameStoreLocation(store,candidate){
 return !(store?.address&&candidate?.address&&store.address.normalize('NFKC').trim()!==candidate.address.normalize('NFKC').trim())&&storeNameKey(store?.name)===storeNameKey(candidate?.name)&&validPoint(store)&&validPoint(candidate)&&Math.abs(store.latitude-candidate.latitude)<0.00001&&Math.abs(store.longitude-candidate.longitude)<0.00001;
}
export async function recoverStoreLink({client,candidate,onSelect,isCurrent=()=>true}){
 if(!isCurrent())return false;
 // A previous confirm may have committed before the response was lost.
 // Re-read the registered stores; do not issue a second registration blindly.
 const stores=await client.stores();
 if(!isCurrent())return false;
 const matching=stores.filter(s=>sameStoreLocation(s,candidate));
 if(matching.length!==1)return false;
 await onSelect({...candidate,id:matching[0].id});
 return isCurrent();
}
export async function confirmManualStore({candidate,approved,client,onSelect,isCurrent=()=>true}){
 if(!candidate||approved!==true||!isCurrent())return false;
 const id=await resolveStoreSelection(client,candidate,isCurrent);
 if(!isCurrent())return false;
 await onSelect({...candidate,id});
 return true;
}
export async function chooseStore({client,point,onSelect,initialName='',referenceAddress='',allowManual=true,isCurrent=()=>true}){
 if(!client?.session())throw Error('この機能はハラケン本人専用です');
 const dialog=document.createElement('dialog');dialog.className='store-link-dialog';dialog.innerHTML='<h3>店舗を確認して関連付け</h3><p>GPSだけで店舗を確定しません。店名・所在地を確認してください。</p><input aria-label="店舗名で絞り込み" placeholder="店舗名で絞り込み"><button type="button" data-near>写真の500m以内を検索</button><button type="button" data-manual>候補にない店舗を手動確認</button><p role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';
 if(!allowManual)dialog.querySelector('[data-manual]').remove();
 document.body.append(dialog);dialog.showModal();const status=dialog.querySelector('[role=status]'),list=dialog.querySelector('[data-list]'),input=dialog.querySelector('input'),near=dialog.querySelector('[data-near]');let rows=[],registeredRows=[],busy=false;input.value=String(initialName||'').slice(0,120);
 const current=()=>dialog.isConnected&&isCurrent();
 let gpsRows=null;
 const draw=()=>{const visible=visibleStoreRows(rows,input.value,referenceAddress);list.innerHTML=visible.map(({r,i})=>'<article class="store-link-card"><button type="button" data-select="'+i+'">'+escape(r.name)+'</button><div class="store-link-address">'+escape(r.address||r.area||'所在地未登録')+'</div><div class="store-link-distance">'+(r.distance_m!=null?'写真位置から約'+r.distance_m+'m':'距離未確認')+'</div></article>').join('');status.textContent=visible.length?(gpsRows===rows?'写真の500m以内の登録店舗：':'登録店舗：')+visible.length+'件。店名・所在地を確認してください。':rows.length?'入力した店名に一致する候補は0件です。入力を消すと元の候補を再表示します。':'該当する登録店舗は0件です。未連携のまま保存できます。';};
 const showDuplicates=error=>{if(!Array.isArray(error?.storeCandidates))return false;rows=error.storeCandidates;input.value='';draw();status.textContent='重複の可能性がある登録店舗です（500m検索とは別の確認）。新規登録せず、所在地・座標を確認して候補を選んでください。';return true;};
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.onclose=()=>dialog.remove();dialog.oncancel=e=>{if(busy)e.preventDefault();};input.oninput=()=>draw();
 if(allowManual)dialog.querySelector('[data-manual]').onclick=async()=>{if(busy||!current())return;
  const name=String(input.value||initialName||'').trim().slice(0,120);
  const address=prompt('店舗の住所を入力してください（地図で確認するために使用。DBには保存されません）。','');
  if(address===null)return;
  if(!name||!address.trim()){status.textContent='店名と住所が必要です。';return;}
  const mapUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' '+address.trim());
  const link=document.createElement('a');link.href=mapUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='地図で店舗位置を確認する';status.replaceChildren('住所を確認しました。',link,'。地図の位置を確認し、緯度・経度を入力してください。');
  const next=document.createElement('button');next.type='button';next.textContent='地図で位置を確認したので座標を入力する';status.append(' ',next);
  next.onclick=async()=>{if(busy||!current())return;
   const latitude=prompt('地図で確認した店舗の緯度を入力してください（写真GPSを転記しないでください）。','');if(latitude===null)return;
  const longitude=prompt('地図で確認した店舗の経度を入力してください。','');if(longitude===null)return;
  const candidate=verifiedManualStore(name,latitude,longitude,point);
  if(candidate)candidate.address=address.normalize('NFKC').trim().slice(0,300);
  if(!candidate){status.textContent='店舗の緯度・経度が不正、または写真GPSと同じです。登録していません。';return;}
  if(!confirm('店舗名：'+name+'\n住所（確認用）：'+address.trim()+'\n緯度：'+candidate.latitude+'\n経度：'+candidate.longitude+'\n\n地図上の店舗位置と一致していますか？登録して食事に関連付けますか？'))return;
  busy=true;try{const saved=await confirmManualStore({candidate,approved:true,client,onSelect,isCurrent:current});if(saved)dialog.close();}catch(error){if(showDuplicates(error))return;try{if(await recoverStoreLink({client,candidate,onSelect,isCurrent:current})){dialog.close();return;}}catch{}status.textContent='関連付けの完了を確認できません。履歴と登録店舗を再取得し、同じ店舗を選び直してください。';}finally{busy=false;}
  };

 };
 near.hidden=!validPoint(point);
 near.onclick=async()=>{if(busy||!validPoint(point))return;busy=true;near.disabled=true;status.textContent='写真周辺の登録店舗を確認しています…';try{const found=await client.nearbyPhotoStores(point);if(!current())return;gpsRows=filterNearbyPhotoStores(found,point);rows=gpsRows;draw();}catch{status.textContent='候補を取得できません。前の検索結果を保持しています。';}finally{busy=false;near.disabled=false;}};
 list.onclick=async e=>{const button=e.target.closest('[data-select]');if(!button||busy||!current())return;const candidate=rows[Number(button.dataset.select)];if(!candidate||!confirm('店舗名：'+candidate.name+'\n所在地：'+(candidate.address||candidate.area||'不明')+'\n緯度：'+(candidate.latitude??'未登録')+' / 経度：'+(candidate.longitude??'未登録')+'\n'+(candidate.distance_m!=null?'写真位置から約'+candidate.distance_m+'m\n':'')+'\nこの店舗で間違いありませんか？'))return;busy=true;button.disabled=true;
 try{const id=await resolveStoreSelection(client,candidate,current);if(!current())return;await onSelect({...candidate,id});dialog.close();}catch{try{if(await recoverStoreLink({client,candidate,onSelect,isCurrent:current})){dialog.close();return;}}catch{}status.textContent='関連付けを確認できません。履歴・登録店舗を再取得して同じ店舗を選び直してください。';}finally{busy=false;button.disabled=false;}};
 try{registeredRows=await client.stores();if(!current())return;rows=validPoint(point)?filterNearbyPhotoStores(registeredRows,point):registeredRows;gpsRows=validPoint(point)?rows:null;draw();if(validPoint(point)&&String(initialName||'').trim())await near.onclick();}catch{status.textContent='登録店舗を取得できません。';}
}
