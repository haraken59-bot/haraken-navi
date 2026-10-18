import {chooseStore,photoPoint} from './store-link-ui.js';
import {officialStoreName} from './places.js';
import {canRestoreMealLearning} from './meal-client.js';
import {prepareMealPhoto,saveMealWithPhotos,downloadMealPhoto} from './meal-photo.js';
import {buildMeal,parseMealText,gpsComparison,duplicateMeals} from './meal-record.js';
import {normalizeStoreName} from './importer/records.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountMealUI({getClient,getOwner,getContext,getDecision,getTest,onSaved,onRefresh,onDeleted=()=>{}}){
 let photos=[],current=null,history=[],stores=[],pending=null,busy=false,photoBusy=false,account=getOwner();
 const form=$('record-form'),legacySubmit=form.onsubmit;
 const status=text=>$('meal-status').textContent=text;
 const guard=fn=>async e=>{try{await fn(e);}catch(error){status(error.message);}};
 form.querySelectorAll('[required]').forEach(e=>e.required=false);
 form.querySelector('button[type=submit]').textContent='内容を確認して食事を保存';
 form.insertAdjacentHTML('afterbegin',`<p>食事は既存の共通履歴へ保存します。食事日時と満足度は必須です。店・料理・写真・金額・感想は空欄でも記録できます。</p><label>ひとこと入力<input id="meal-talk" placeholder="ミックスフライ定食 880" maxlength="300"></label><button type="button" id="meal-parse" class="secondary">入力欄に反映</button><p class="muted">「かちかち山へ行きました」→「4」→「ミックスフライ定食 880」の順でも入力できます。内容を確認してから保存してください。</p><div class="grid"><label>食事日時<input id="meal-date" type="datetime-local"></label><label>料理ジャンル<select id="meal-genre"><option>不明</option>${['定食','ラーメン','うどん','そば','寿司','焼き鳥','中華','カレー','丼','洋食','居酒屋料理','軽食','その他'].map(x=>'<option>'+x+'</option>').join('')}</select></label></div>`);
 $('actual-store').insertAdjacentHTML('afterend','<select id="meal-store-id" aria-label="既存店舗"><option value="">店名で記録（店舗マスタは変更しません）</option></select>');
 $('change-reason').closest('label').insertAdjacentHTML('afterend',`<label>食事の感想・コメント<textarea id="meal-comment" maxlength="2000" placeholder="味は美味しかった。量がもう少しあれば5。"></textarea></label><label>同行者・状況（任意）<input id="meal-companion" maxlength="200"></label><div class="grid"><label>写真を選ぶ<input id="meal-files" type="file" accept="image/*" multiple></label><label>カメラで撮る<input id="meal-camera" type="file" accept="image/*" capture="environment"></label></div><p class="muted">最大5枚・1枚20MB／合計50MBまで。原画を非公開で保存し、履歴には軽量画像を表示します。写真GPSなしでも保存できます。</p><div id="meal-photos"></div><button id="meal-gps" type="button" class="secondary">記録時の現在地を取得</button><p id="meal-gps-status">現在地は未取得です。写真GPS・店舗GPSと別々に保存します。</p>`);
 form.insertAdjacentHTML('afterend','<p id="meal-status" role="status"></p><p id="meal-delete-status" role="status"></p><button type="button" id="meal-delete-retry" hidden>未完了の写真削除を再試行</button><div id="meal-cloud-history"></div><button id="meal-more" class="quiet" hidden>過去の食事をさらに表示</button>');

 const nowInput=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};$('meal-date').value=nowInput();
 const invalidate=()=>{if(!busy)pending=null;};form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
 function selectedStore(){const master=stores.find(s=>s.id===$('meal-store-id').value&&normalizeStoreName(s.name)===normalizeStoreName($('actual-store').value));if(master)return {latitude:master.latitude,longitude:master.longitude};const name=normalizeStoreName($('actual-store').value);const c=getDecision()?.latest_choice;return c&&normalizeStoreName(c.name)===name?{latitude:c.latitude,longitude:c.longitude}:null;}
 function showPhotos(){ $('meal-photos').innerHTML=photos.map((p,i)=>`<div><img width="100" alt="選択した食事写真" src="${p.thumbnail||''}"><span>${esc(p.name)} / ${esc(p.taken_at||'撮影日時不明')} / ${p.gps?'写真GPSあり':'写真GPSなし'}</span><button type="button" data-photo-store="${i}">店舗を確認</button><button type="button" data-remove-photo="${i}">外す</button>${p.taken_at?`<button type="button" data-photo-date="${i}">この撮影日時を使う</button>`:''}<p>${esc(gpsComparison(current,p.gps,selectedStore()).notes.join('。'))}</p></div>`).join('');}
 const addPhotos=guard(async e=>{if(busy||photoBusy)return;photoBusy=true;const startOwner=getOwner();try{const files=[...e.target.files];if(files.length+photos.length>5)throw Error('写真は1食5枚まで選べます。');status('写真の日時とGPSを確認しています…');for(const file of files){const row=await prepareMealPhoto(file);try{if(getOwner()!==startOwner)throw Error('アカウントが変わりました。写真を選び直してください。');if(!photos.some(p=>p.fingerprint===row.fingerprint))photos.push(row);}finally{URL.revokeObjectURL(row.url);row.blob=null;}}pending=null;showPhotos();status('写真を追加しました。撮影日時を確認し、必要なら食事日時を修正してください。');}finally{photoBusy=false;e.target.value='';}});
 $('meal-files').onchange=addPhotos;$('meal-camera').onchange=addPhotos;
 $('meal-photos').onclick=e=>{const storeButton=e.target.closest('[data-photo-store]');if(storeButton&&!busy){const who=getOwner();void chooseStore({client:getClient(),point:photos[Number(storeButton.dataset.photoStore)]?.gps,isCurrent:()=>getOwner()===who&&!!getClient(),onSelect:async s=>{if(!stores.some(x=>x.id===s.id)){stores.push(s);const option=document.createElement('option');option.value=s.id;option.textContent=s.name;$('meal-store-id').append(option);}$('meal-store-id').value=s.id;$('actual-store').value=s.name;pending=null;showPhotos();}}).catch(()=>status('店舗確認を開始できません。'));return;}const dateButton=e.target.closest('[data-photo-date]');if(dateButton&&!busy){const d=new Date(photos[Number(dateButton.dataset.photoDate)].taken_at);$('meal-date').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);pending=null;status('写真の日時を食事日時へ反映しました。日付と時刻を確認してください。');}const button=e.target.closest('[data-remove-photo]');if(button&&!busy){photos.splice(Number(button.dataset.removePhoto),1);pending=null;showPhotos();}};
 $('meal-parse').onclick=guard(()=>{const parsed=parseMealText({},$('meal-talk').value);for(const [k,id]of Object.entries({store_name:'actual-store',dish_name:'actual-dish',amount_jpy:'actual-amount',satisfaction:'actual-rating'}))if(parsed[k]!=null)$(id).value=parsed[k];if(parsed.store_name)$('meal-store-id').value='';pending=null;$('meal-talk').value='';status('入力欄へ反映しました。確認して保存してください。');});
 $('meal-talk').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('meal-parse').click();}};
 $('meal-gps').onclick=()=>{if(!navigator.geolocation){status('現在地を取得できません。位置情報なしでも保存できます。');return;}const startOwner=getOwner();navigator.geolocation.getCurrentPosition(p=>{if(startOwner!==getOwner())return;current={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy_m:p.coords.accuracy,captured_at:new Date().toISOString()};pending=null;$('meal-gps-status').textContent='記録時の現在地を取得しました（精度 約'+Math.round(p.coords.accuracy)+'m）。';showPhotos();},()=>status('現在地を取得できません。写真・店舗の位置と混同せず、現在地なしで保存できます。'),{timeout:10000,maximumAge:0});};
 $('actual-store').addEventListener('blur',()=>{const matches=stores.filter(s=>normalizeStoreName(s.name)===normalizeStoreName($('actual-store').value));if(matches.length===1)$('meal-store-id').value=matches[0].id;showPhotos();});
 $('actual-store').addEventListener('input',()=>{$('meal-store-id').value='';showPhotos();});
 $('meal-store-id').onchange=()=>{const s=stores.find(s=>s.id===$('meal-store-id').value);if(s)$('actual-store').value=s.name;pending=null;showPhotos();};
 function renderHistory(){ $('meal-cloud-history').innerHTML='<h3>共通の食事履歴</h3>'+history.map(r=>{const m=r.navi_metadata||{};return `<div class="record"><b>${esc(officialStoreName(r.store_name)||'店舗未記入')}</b> · ${esc(r.dish_name||'料理未記入')}<br>${esc(r.eaten_at?new Date(r.eaten_at).toLocaleString('ja-JP'):'日時不明')} / ${r.amount_jpy==null?'金額未記入':esc(r.amount_jpy)+'円'} / 満足度 ${esc(r.satisfaction??'未記入')}<p>${esc(r.comment)}</p>${m.is_test?'テスト · ':''}${m.exclude_from_learning?'学習対象外':''}${m.version?`<p>AI推薦：${esc(officialStoreName(m.first_recommendation?.name)||'なし')}<br>最初の選択：${esc(officialStoreName(m.initial_choice?.name)||'なし')}<br>最後の選択：${esc(officialStoreName(m.latest_choice?.name)||'未記録')}<br>実際の店：${esc(officialStoreName(r.store_name))}<br>変更理由：${esc(m.change_reason||'なし')}</p>`:''}<button type="button" class="quiet" data-photo-id="${esc(r.id)}">写真・位置情報（${r.photo_count||0}枚）</button><button type="button" class="quiet" data-link-store="${esc(r.id)}">店舗を関連付け</button><button type="button" class="quiet" data-edit-meal="${esc(r.id)}">編集</button>${canRestoreMealLearning(r)?`<button type="button" class="quiet" data-restore-learning="${esc(r.id)}">学習対象に戻す</button>`:''}<div id="photos-${esc(r.id)}"></div></div>`;}).join('');}
 function openEdit(row){
  const existing=document.getElementById('meal-edit-dialog');existing?.remove();
  const dialog=document.createElement('dialog');dialog.id='meal-edit-dialog';
  const date=new Date(row.eaten_at),localDate=Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  dialog.innerHTML=`<form><h3>食事履歴を編集</h3><label>店名<input name="store" maxlength="120" value="${esc(row.store_name)}"></label><label>料理名<input name="dish" maxlength="160" value="${esc(row.dish_name)}"></label><label>日時<input name="date" type="datetime-local" required value="${esc(localDate)}"></label><label>コメント<textarea name="comment" maxlength="2000">${esc(row.comment)}</textarea></label><label>金額（円・空欄可）<input name="amount" type="number" min="0" max="2147483647" step="1" value="${esc(row.amount_jpy)}"></label><label>満足度<select name="rating"><option value="">未記入</option>${[1,2,3,4,5].map(v=>`<option value="${v}" ${v===row.satisfaction?'selected':''}>${v}</option>`).join('')}</select></label><p role="status"></p><button type="submit">変更を保存</button><button type="button">キャンセル</button><button type="button" data-delete-meal>削除</button></form>`;
  document.body.append(dialog);const f=dialog.querySelector('form'),message=dialog.querySelector('[role=status]'),startOwner=getOwner();let saving=false;
  dialog.querySelector('[type=button]').onclick=()=>{if(!saving)dialog.close();};dialog.onclose=()=>dialog.remove();dialog.oncancel=e=>{if(saving)e.preventDefault();};
  const deleteButton=dialog.querySelector('[data-delete-meal]');
  deleteButton.onclick=async()=>{
   if(saving||busy||startOwner!==getOwner()||!getClient()?.session())return;
   const warning='この食事履歴を削除します。元に戻せません。'+((row.photo_count||row.navi_metadata?.original_photos?.length)?'\n写真も削除されます。':'');
   if(!window.confirm(warning))return;
   saving=true;busy=true;deleteButton.disabled=true;f.querySelector('[type=submit]').disabled=true;
   try{
    const deleted=await getClient().deleteMeal(row);if(startOwner!==getOwner())return;
    if(!['done','pending','missing'].includes(deleted.state))throw Error('unconfirmed');
    history=history.filter(r=>r.id!==row.id);renderHistory();dialog.close();await onDeleted(row.id);
    deletionNotice(deleted.state==='pending'?1:0);
    try{await onRefresh();await reload();status(deleted.state==='pending'?'履歴を削除しました。写真削除は未完了です。再試行できます。':'食事履歴と関連写真を削除しました。');}
    catch{status('履歴の削除を受け付けました。表示更新を確認できないため履歴を再取得してください。');}
   }catch{message.textContent='削除を確認できませんでした。履歴を再取得してください。';}
   finally{saving=false;busy=false;deleteButton.disabled=false;f.querySelector('[type=submit]').disabled=false;}
  };
  f.onsubmit=async e=>{e.preventDefault();if(saving)return;if(startOwner!==getOwner()){message.textContent='アカウントが変わりました。閉じて履歴を再取得してください。';return;}saving=true;const button=f.querySelector('[type=submit]');button.disabled=true;
   try{const data=new FormData(f),patch={dish_name:String(data.get('dish')).trim(),eaten_at:new Date(data.get('date')).toISOString(),comment:String(data.get('comment')).trim()};
    patch.amount_jpy=data.get('amount')===''?null:Number(data.get('amount'));patch.satisfaction=data.get('rating')===''?null:Number(data.get('rating'));
    const name=String(data.get('store')).trim();if(name!==(row.store_name||'')){patch.store_id=null;patch.unlinked_store_name=name;}
    await getClient().editMeal(row,patch);dialog.close();await onRefresh();await reload();status('履歴を更新しました。');
   }catch{message.textContent='保存または再取得を確認できませんでした。履歴を再取得して確認してください。';}finally{saving=false;button.disabled=false;}
  };dialog.showModal();
 }
 function deletionNotice(count){$('meal-delete-status').textContent=count?'写真の削除が未完了です。対象は保存されています。1分ほど待って再試行してください。':'';$('meal-delete-retry').hidden=!count;}
 let checkingDeletion=false;
 async function resumeDeletions(){if(checkingDeletion||!getClient()?.session())return;checkingDeletion=true;const who=getOwner();$('meal-delete-retry').disabled=true;try{const r=await getClient().resumeMealDeletions();if(who===getOwner())deletionNotice(r.pending);}catch{if(who===getOwner()){$('meal-delete-status').textContent='写真削除の完了確認ができません。再試行できます。';$('meal-delete-retry').hidden=false;}}finally{checkingDeletion=false;$('meal-delete-retry').disabled=false;}}
 $('meal-delete-retry').onclick=()=>void resumeDeletions();
 async function reload(reset=true){if(!getClient()?.session())return;const startOwner=getOwner();const rows=await getClient().historyPage(reset?0:history.length);if(startOwner!==getOwner())return;history=reset?rows:[...history,...rows];$('meal-more').hidden=rows.length<100;renderHistory();}
 $('meal-more').onclick=guard(()=>reload(false));
 $('meal-cloud-history').onclick=guard(async e=>{const link=e.target.closest('[data-link-store]');if(link&&!busy){const row=history.find(r=>r.id===link.dataset.linkStore),who=getOwner();if(!row)return;await chooseStore({client:getClient(),point:photoPoint(row.navi_metadata),initialName:row.store_name||'',isCurrent:()=>getOwner()===who&&!!getClient(),onSelect:async store=>{await getClient().editMeal(row,{store_id:store.id});await onRefresh();await reload();status('店舗を関連付けました。写真・食事内容は変更していません。');}});return;}const restore=e.target.closest('[data-restore-learning]');if(restore){
 const row=history.find(r=>r.id===restore.dataset.restoreLearning);
 if(busy||!canRestoreMealLearning(row)||!confirm('この記録を学習対象に戻しますか？'))return;
 const owner=getOwner();busy=true;restore.disabled=true;
 try{await getClient().restoreMealLearning(row);if(owner!==getOwner())return;await onRefresh();await reload();status('学習対象に戻しました。');}
 catch{status('変更または再取得を確認できませんでした。履歴を再取得してください。');}
 finally{busy=false;restore.disabled=false;}return;
 }const edit=e.target.closest('[data-edit-meal]'),ph=e.target.closest('[data-photo-id]');if(edit){const row=history.find(r=>r.id===edit.dataset.editMeal);openEdit(row);return;}if(ph){const row=history.find(r=>r.id===ph.dataset.photoId),m=row.navi_metadata||{},owner=getOwner();const images=await getClient().mealPhotos(row.id);if(owner!==getOwner())return;const node=$('photos-'+row.id);if(!node)return;node.onclick=guard(async ev=>{const b=ev.target.closest('[data-download-image]');if(!b)return;const image=images.find(i=>i.id===b.dataset.downloadImage);b.disabled=true;try{const result=await downloadMealPhoto(getClient(),row,image);if(owner!==getOwner())return;const url=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=url;a.download=result.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}finally{b.disabled=false;}});node.innerHTML=images.map(i=>`<div>${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(i.thumbnail||'')?`<img width="160" alt="保存済みの食事写真" src="${i.thumbnail}">`:'表示用画像なし'}<button type="button" data-download-image="${esc(i.id)}">${m.original_photos?.some(p=>p.image_id===i.id)?'原画をダウンロード':'保存済み画像をダウンロード（旧画質）'}</button></div>`).join('')+`<p>現在地：${m.current_location?'取得済み':'なし'} / 推薦時GPS：${m.recommendation_location?'あり':'なし'} / 写真GPS：${m.photo_locations?.some(x=>x.location)?'あり':'なし・旧記録は未取得'} / 店舗GPS：${m.store_location?'あり':'なし'}</p><p>${esc((m.gps_comparisons||[]).flatMap(x=>x.notes||[]).join('。'))}</p>`;}});
 form.onsubmit=guard(async e=>{e.preventDefault();if($('actual-kind').value==='action')return legacySubmit(e);if(busy)return;if(photoBusy)throw Error('写真の確認が終わるまでお待ちください。');if(!getClient()?.session())throw Error('共通履歴への保存には「接続・設定」からログインしてください。');
  const button=form.querySelector('button[type=submit]'),startOwner=getOwner();busy=true;button.disabled=true;
  try{
   if(!pending){const input={eaten_at:$('meal-date').value,store_name:$('actual-store').value,store_id:stores.find(s=>s.id===$('meal-store-id').value&&normalizeStoreName(s.name)===normalizeStoreName($('actual-store').value))?.id||null,dish_name:$('actual-dish').value,amount_jpy:$('actual-amount').value,satisfaction:$('actual-rating').value,comment:$('meal-comment').value,genre:$('meal-genre').value,companion:$('meal-companion').value,change_reason:[$('change-reason-type').value,$('change-reason').value].filter(Boolean).join('：'),exclude_from_learning:false};pending=buildMeal(input,{photos,current,store:selectedStore(),decision:getDecision(),context:getContext(),isTest:getTest()});const dup=duplicateMeals(pending,history);if(dup.length){pending=null;throw Error('同じ時間帯・店舗の記録があります。共通の食事履歴を確認してください。');}}
   const saved=pending;status('共通履歴へ保存しています…');await saveMealWithPhotos(getClient(),saved,photos);
   if(startOwner!==getOwner())throw Error('保存中にアカウントが変わりました。元のアカウントで履歴を確認してください。');
   pending=null;photos=[];current=null;form.reset();$('meal-date').value=nowInput();$('meal-gps-status').textContent='現在地は未取得です。写真GPS・店舗GPSと別々に保存します。';showPhotos();
   try{await onSaved(saved);await onRefresh();await reload();status('共通の食事履歴に保存しました。'+(saved.navi_metadata.exclude_from_learning?'学習には使いません。':'次回の推薦に反映します。'));}catch{status('クラウド保存は完了しました。履歴の再取得に失敗したため「履歴を再取得」を押してください。再登録は不要です。');}
  }finally{busy=false;button.disabled=false;}
 });
 return {async refresh(){if(account!==getOwner()){deletionNotice(0);account=getOwner();photos=[];current=null;history=[];pending=null;form.reset();$('meal-date').value=nowInput();showPhotos();renderHistory();}if(!getClient()?.session()){history=[];renderHistory();return;}await reload();void resumeDeletions();stores=await getClient().stores();$('meal-store-id').innerHTML='<option value="">店名で記録（店舗マスタは変更しません）</option>'+stores.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} ${esc(s.area)}</option>`).join('');}};
}



