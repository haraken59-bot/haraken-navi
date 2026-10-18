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
export async function chooseStore({client,point,onSelect,initialName='',referenceAddress='',isCurrent=()=>true}){
 if(!client?.session())throw Error('この機能はハラケン本人専用です');
 const dialog=document.createElement('dialog');dialog.innerHTML='<h3>店舗を確認して関連付け</h3><p>GPSだけで店舗を確定しません。店名・所在地を確認してください。</p><input aria-label="店舗名で絞り込み" placeholder="店舗名で絞り込み"><button type="button" data-near>写真の500m以内を検索</button><button type="button" data-manual>候補にない店舗を手動確認</button><p role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';
 document.body.append(dialog);dialog.showModal();const status=dialog.querySelector('[role=status]'),list=dialog.querySelector('[data-list]'),input=dialog.querySelector('input'),near=dialog.querySelector('[data-near]');let rows=[],busy=false;input.value=String(initialName||'').slice(0,120);
 const current=()=>dialog.isConnected&&isCurrent();
 const draw=()=>{list.innerHTML=visibleStoreRows(rows,input.value,referenceAddress).map(({r,i,rank})=>'<p><button type="button" data-select="'+i+'">'+escape(r.name)+'</button> '+escape(r.address||r.area||'')+(r.distance_m!=null?' / 約'+r.distance_m+'m':'')+(rank.exact?' / 店名一致':'')+(rank.addressMatch?' / 所在地一致':'')+'</p>').join('');};
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.onclose=()=>dialog.remove();dialog.oncancel=e=>{if(busy)e.preventDefault();};input.oninput=()=>{draw();status.textContent=storeListStatus(rows,input.value);};
 dialog.querySelector('[data-manual]').onclick=async()=>{if(busy||!current())return;
  const name=String(input.value||initialName||'').trim().slice(0,120);
  const address=prompt('店舗の住所を入力してください（地図で確認するために使用。DBには保存されません）。','');
  if(address===null)return;
  if(!name||!address.trim()){status.textContent='店名と住所が必要です。';return;}
  const mapUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' '+address.trim());
  const link=document.createElement('a');link.href=mapUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='地図で店舗位置を確認する';status.replaceChildren('住所を確認しました。',link,'。地図の位置を確認し、緯度・経度を入力してください。');
  const latitude=prompt('地図で確認した店舗の緯度を入力してください（写真GPSを転記しないでください）。','');if(latitude===null)return;
  const longitude=prompt('地図で確認した店舗の経度を入力してください。','');if(longitude===null)return;
  const candidate=verifiedManualStore(name,latitude,longitude,point);
  if(!candidate){status.textContent='店舗の緯度・経度が不正、または写真GPSと同じです。登録していません。';return;}
  if(!confirm('店舗名：'+name+'\n住所（確認用）：'+address.trim()+'\n緯度：'+candidate.latitude+'\n経度：'+candidate.longitude+'\n\n地図上の店舗位置と一致していますか？登録して食事に関連付けますか？'))return;
  busy=true;try{const id=await client.confirmStore(candidate);if(!current())return;await onSelect({...candidate,id});dialog.close();}catch{status.textContent='店舗登録または関連付けに失敗しました。入力とログイン状態を確認してください。';}finally{busy=false;}
 };
 near.hidden=!validPoint(point);
 near.onclick=async()=>{if(busy)return;busy=true;near.disabled=true;status.textContent='写真周辺を検索しています…';try{const found=await client.nearbyPhotoStores(point,initialName);if(!current())return;rows=found;input.value='';draw();status.textContent=rows.length?'候補を選び、確認してください。':'写真周辺に候補がありません。店舗ID未設定のまま保存できます。';}catch{status.textContent='候補を取得できません。未連携のまま保存できます。';}finally{busy=false;near.disabled=false;}};
 list.onclick=async e=>{const button=e.target.closest('[data-select]');if(!button||busy||!current())return;const candidate=rows[Number(button.dataset.select)];if(!candidate||!confirm('「'+candidate.name+'」をこの食事の店舗として関連付けますか？'))return;busy=true;button.disabled=true;
 try{const id=candidate.id||await client.confirmStore(candidate);if(!current())return;await onSelect({...candidate,id});dialog.close();}catch{status.textContent='関連付けを確認できません。履歴・店舗を再取得してください。';}finally{busy=false;button.disabled=false;}};
 try{rows=await client.stores();if(!current())return;draw();status.textContent=storeListStatus(rows,input.value);}catch{status.textContent='登録店舗を取得できません。';}
}
