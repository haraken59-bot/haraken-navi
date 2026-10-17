import {validPoint} from './places.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function photoPoint(metadata){return [metadata?.photo_location,...(metadata?.photo_locations||[]).map(x=>x.location)].find(p=>validPoint(p)&&(p.latitude!==0||p.longitude!==0))||null;}
export async function chooseStore({client,point,onSelect,isCurrent=()=>true}){
 if(!client?.session())throw Error('この機能はハラケン本人専用です');
 const dialog=document.createElement('dialog');dialog.innerHTML='<h3>店舗を確認して関連付け</h3><p>GPSだけで店舗を確定しません。店名・所在地を確認してください。</p><input aria-label="店舗名で絞り込み" placeholder="店舗名で絞り込み"><button type="button" data-near>写真の500m以内を検索</button><p role="status"></p><div data-list></div><button type="button" data-close>閉じる</button>';
 document.body.append(dialog);dialog.showModal();const status=dialog.querySelector('[role=status]'),list=dialog.querySelector('[data-list]'),input=dialog.querySelector('input'),near=dialog.querySelector('[data-near]');let rows=[],busy=false;
 const current=()=>dialog.isConnected&&isCurrent();
 const draw=()=>{list.innerHTML=rows.map((r,i)=>({r,i})).filter(({r})=>r.name.includes(input.value.trim())).map(({r,i})=>'<p><button type="button" data-select="'+i+'">'+escape(r.name)+'</button> '+escape(r.address||r.area||'')+(r.distance_m!=null?' / 約'+r.distance_m+'m':'')+'</p>').join('');};
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.onclose=()=>dialog.remove();dialog.oncancel=e=>{if(busy)e.preventDefault();};input.oninput=draw;
 near.hidden=!validPoint(point);
 near.onclick=async()=>{if(busy)return;busy=true;near.disabled=true;status.textContent='写真周辺を検索しています…';try{const found=await client.nearbyPhotoStores(point);if(!current())return;rows=found;draw();status.textContent=rows.length?'候補を選び、確認してください。':'写真周辺に候補がありません。店舗ID未設定のまま保存できます。';}catch{status.textContent='候補を取得できません。未連携のまま保存できます。';}finally{busy=false;near.disabled=false;}};
 list.onclick=async e=>{const button=e.target.closest('[data-select]');if(!button||busy||!current())return;const candidate=rows[Number(button.dataset.select)];if(!candidate||!confirm('「'+candidate.name+'」をこの食事の店舗として関連付けますか？'))return;busy=true;button.disabled=true;
 try{const id=candidate.id||await client.confirmStore(candidate);if(!current())return;await onSelect({...candidate,id});dialog.close();}catch{status.textContent='関連付けを確認できません。履歴・店舗を再取得してください。';}finally{busy=false;button.disabled=false;}};
 try{rows=await client.stores();if(!current())return;draw();status.textContent=rows.length?'登録店舗から選べます。':'登録店舗がありません。店舗ID未設定でも保存できます。';}catch{status.textContent='登録店舗を取得できません。';}
}
