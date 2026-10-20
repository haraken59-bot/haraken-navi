import {validPoint} from './places.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function storeNameKey(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\u3000・･\-ー_()（）]/g,'').replace(/^(?:やきとり|焼き鳥|焼鳥)(?=.)/,'焼鳥');}
export function matchingStores(rows,query){const key=storeNameKey(query);if(!key)return rows;return rows.filter(r=>storeNameKey(r.name).includes(key));}
export function storeCandidateRank(row,query,referenceAddress=''){
 const name=storeNameKey(row.name),wanted=storeNameKey(query);
 const address=storeNameKey(row.address||row.area),reference=storeNameKey(referenceAddress);
 const exact=Boolean(wanted)&&name===wanted,partial=Boolean(wanted)&&name.includes(wanted);
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
 const matches=stores.filter(s=>sameStoreLocation(s,candidate));
 if(matches.length===1)return matches[0].id;
 if(matches.length>1)throw Error('同名の登録店舗が複数あります。店舗を確認してください。');
 if(stores.some(s=>storeNameKey(s.name)===storeNameKey(candidate.name)))throw Error('同名の登録店舗があります。場所を確認してから紐付けしてください。');
 return client.confirmStore(candidate);
}
export function sameStoreLocation(store,candidate){
 return storeNameKey(store?.name)===storeNameKey(candidate?.name)&&validPoint(store)&&validPoint(candidate)&&Math.abs(store.latitude-candidate.latitude)<0.00001&&Math.abs(store.longitude-candidate.longitude)<0.00001;
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
 const dialog=document.createElement('dialog');dialog.innerHTML='<h3>店舗を確認して関連付け</h3><p>GPSだけで店舗を確定しません。店名・所在地を確認してください。</p><input aria-label="店舗名で絞り込み" placeholder="店舗名で絞り込み"><button type="button" data-near>写真の500m以内を検索</button><button type="button" data-manual>候補にない店舗を手動確認</button><p role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';
 if(!allowManual)dialog.querySelector('[data-manual]').remove();
 document.body.append(dialog);dialog.showModal();const status=dialog.querySelector('[role=status]'),list=dialog.querySelector('[data-list]'),input=dialog.querySelector('input'),near=dialog.querySelector('[data-near]');let rows=[],registeredRows=[],busy=false;input.value=String(initialName||'').slice(0,120);
 const current=()=>dialog.isConnected&&isCurrent();
 const draw=()=>{list.innerHTML=visibleStoreRows(rows,input.value,referenceAddress).map(({r,i,rank})=>'<p><button type="button" data-select="'+i+'">'+escape(r.name)+'</button> '+escape(r.address||r.area||'')+(r.distance_m!=null?' / 約'+r.distance_m+'m':'')+(rank.exact?' / 店名一致':'')+(rank.addressMatch?' / 所在地一致':'')+'</p>').join('');};
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.onclose=()=>dialog.remove();dialog.oncancel=e=>{if(busy)e.preventDefault();};input.oninput=()=>{draw();status.textContent=storeListStatus(rows,input.value);};
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
  if(!candidate){status.textContent='店舗の緯度・経度が不正、または写真GPSと同じです。登録していません。';return;}
  if(!confirm('店舗名：'+name+'\n住所（確認用）：'+address.trim()+'\n緯度：'+candidate.latitude+'\n経度：'+candidate.longitude+'\n\n地図上の店舗位置と一致していますか？登録して食事に関連付けますか？'))return;
  busy=true;try{const saved=await confirmManualStore({candidate,approved:true,client,onSelect,isCurrent:current});if(saved)dialog.close();}catch{try{if(await recoverStoreLink({client,candidate,onSelect,isCurrent:current})){dialog.close();return;}}catch{}status.textContent='関連付けの完了を確認できません。履歴と登録店舗を再取得し、同じ店舗を選び直してください。';}finally{busy=false;}
  };

 };
 near.hidden=!validPoint(point);
 if(validPoint(point)&&String(initialName||'').trim())near.textContent='店名と写真位置から自動検索';
 near.onclick=async()=>{if(busy)return;busy=true;near.disabled=true;status.textContent='写真周辺を検索しています…';try{const query=String(input.value||'').normalize('NFKC').trim().slice(0,60);const found=await client.nearbyPhotoStores(point,query);if(!current())return;rows=found.length?[...found,...registeredRows.filter(s=>!found.some(c=>linkedStoreId(c)===s.id||sameStoreLocation(c,s)))]:registeredRows;const matched=visibleStoreRows(rows,query,referenceAddress);input.value=query;draw();status.textContent=matched.length?'店名が一致する候補を優先表示しています。店舗を確認してください。':rows.length?'入力した店名に一致する候補はありません。検索語を変更するか消して確認してください。' :registeredRows.length?'写真周辺に候補がありません。登録済み店舗を表示しています。該当店舗がなければ未連携のまま保存できます。':'写真周辺に候補がありません。店舗ID未設定のまま保存できます。';}catch{status.textContent='候補を取得できません。未連携のまま保存できます。';}finally{busy=false;near.disabled=false;}};
 list.onclick=async e=>{const button=e.target.closest('[data-select]');if(!button||busy||!current())return;const candidate=rows[Number(button.dataset.select)];if(!candidate||!confirm('店舗名：'+candidate.name+'\n所在地：'+(candidate.address||candidate.area||'不明')+'\n'+(candidate.distance_m!=null?'写真位置から約'+candidate.distance_m+'m\n':'')+'\nこの店舗で間違いありませんか？'))return;busy=true;button.disabled=true;
 try{const id=await resolveStoreSelection(client,candidate,current);if(!current())return;await onSelect({...candidate,id});dialog.close();}catch{try{if(await recoverStoreLink({client,candidate,onSelect,isCurrent:current})){dialog.close();return;}}catch{}status.textContent='関連付けを確認できません。履歴・登録店舗を再取得して同じ店舗を選び直してください。';}finally{busy=false;button.disabled=false;}};
 try{rows=await client.stores();registeredRows=rows;if(!current())return;draw();status.textContent=storeListStatus(rows,input.value);if(validPoint(point)&&String(initialName||'').trim())await near.onclick();}catch{status.textContent='登録店舗を取得できません。';}
}
