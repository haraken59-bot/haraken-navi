import {officialStoreName} from './places.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compactReason(c){return String(c.reason||'').replace(/自分の食事傾向を参考|満足度の高かった料理・ジャンルを参考|直近の重複も考慮/g,'').replace(/・{2,}/g,'・').replace(/^・|・$/g,'')||c.genre_fit?.reason||'詳しい条件は詳細で確認';}
export function hoursRows(raw){
 const text=String(raw||'');
 const m=text.match(/^([^（）]+?)\s*（料理L\.O\.\s*([^（）]+?)\s+ドリンクL\.O\.\s*([^（）]+?)）$/);
 if(m)return [['営業時間',m[1].trim()],['料理ラストオーダー',m[2].trim()],['ドリンクラストオーダー',m[3].trim()]];
 // Strict whole-string grammar; only whitespace is replaced by line breaks.
 const day='(?:月|火|水|木|金|土|日|祝日|祝前日)(?:曜日)?';
 const days=day+'(?:[〜～~、・,－-]'+day+')*';
 const time='(?:翌)?[0-2]?[0-9]:[0-5][0-9]';
 const span=time+'[〜～~－-]'+time+'(?:\\s*[（(](?:料理|ドリンク)?L\\.O\\.\\s*'+time+'(?:\\s+(?:料理|ドリンク)L\\.O\\.\\s*'+time+')?[）)])?';
 const group=days+'[：:]?\\s*'+span+'(?:\\s+'+span+')*';
 if(new RegExp('^'+group+'(?:\\s*'+group+')*$').test(text)) {
  return [['営業時間',text.replace(new RegExp('([）)])(?='+days+')','g'),'$1\n\n').replace(new RegExp('('+days+'[：:]?)\\s*(?=(?:翌)?[0-9])','g'),'$1\n').replace(new RegExp('\\s+(?='+days+'[：:]?\\s*(?:翌)?[0-9])','g'),'\n\n').replace(new RegExp('\\s+(?='+span+')','g'),'\n')]];
 }
 return [['営業時間',text||'要確認']];
}
function hoursHTML(c){return '<dl class="store-facts">'+[...hoursRows(c.hours),['情報元',c.source||'未確認'],['確認日',c.observed_at?.slice(0,10)||'未確認']].map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';}
export function renderCandidate(c,i,ctx){
 const price=c.pricing?.labels?.[0]||(c.price==null?'予算未確認':`約${Number(c.price).toLocaleString()}円（記録時）`);
 const travel=c.travel==null?'移動時間未確認':`${ctx.transport==='walk'?'徒歩':'車・交通機関'} 約${c.travel}分`;
 const hp=c.hotpepper,genre=(c.tags||[]).slice(0,3).join('・')||(c.kind==='action'?'行動の選択肢':'料理ジャンル未確認');
 return `<article class="candidate ${i===0?'first':''}"><div class="rank">${i==null?'別の食べ方・行動':`第${i+1}候補`}</div><h3>${esc(officialStoreName(c.name))}${c.visit_mode==='takeout'?'（持ち帰り）':''}</h3>${ctx.guest&&['used','revisited'].includes(c.haraken_usage)?`<span class="pill">${c.haraken_usage==='revisited'?'ハラケン再訪あり':'ハラケン利用あり'}</span>`:''}<div class="muted">${esc(genre)}</div><div class="meta"><span>${esc(travel)}</span><span>${esc(price)}</span></div><p class="reason">${esc(compactReason(c))}</p>${ctx.guest?'':`<button data-select="${esc(c.id)}">これにする</button>`}<details class="candidate-details"><summary><span class="detail-open">詳細を見る</span><span class="detail-close">閉じる</span></summary><p>${esc(c.dish)}</p><p class="muted">${esc(c.reason)}</p>${hoursHTML(c)}<p class="muted">${esc(c.label)}<br>${esc((c.pricing?.labels||[]).join(' ／ '))}<br>${c.distance_m!=null?'直線約'+esc(c.distance_m)+'m · ':''}${esc(travel)}${c.travel_minutes==null&&c.kind==='store'?'（直線距離から概算）':''}<br>${esc(ctx.guest?'':c.kind==='store'?(c.visited?'訪問記録あり':'訪問記録なし'):'')}<br>${esc(c.op?.label)}<br>${esc(c.source)} · ${esc(c.confidence)}${c.observed_at?' · '+esc(c.observed_at.slice(0,10)):''}</p>${c.genre_fit?`<p class="muted">${esc(c.genre_fit.reason)}<br>${c.genre_fit.evidence.map(e=>esc(e.text)+'（'+esc(e.provider||e.source)+'）').join('<br>')}</p>`:''}${hp?`<p class="muted">ランチ：${esc(hp.lunch||'要確認')}<br>飲み放題：${esc(hp.free_drink||'要確認')}<br>食べ放題：${esc(hp.free_food||'要確認')}<br>焼酎充実：${hp.shochu_rich===true?'検索条件に該当':'未確認・取扱いなしとは限りません'}<br>日本酒充実：${hp.sake_rich===true?'検索条件に該当':'未確認・取扱いなしとは限りません'}<br>定休日掲載：${esc(hp.close||'要確認')}</p>`:''}${c.takeout_evidence?`<p class="muted">持ち帰り根拠：${esc(c.takeout_evidence.source)} · ${esc(c.takeout_evidence.evidence)}<br>掲載は店単位の情報です。希望の料理を持ち帰れるかは要確認。</p>`:''}${c.discovered&&/^https?:\/\//.test(c.source_url||'')?`<p><a href="${esc(c.source_url)}" target="_blank" rel="noopener noreferrer">店舗の掲載情報を確認 ↗</a></p>`:''}${c.bottles?.length?`<p>キープ：${c.bottles.map(b=>esc(b.brand)+' '+esc(b.remaining_percent)+'%').join(' / ')}</p>`:''}<div class="card-actions">${!ctx.guest&&c.kind==='store'?`<button class="secondary" data-event="full" data-id="${esc(c.id)}">満席・行列</button><button class="secondary" data-event="closed" data-id="${esc(c.id)}">本日休業</button><button class="quiet" data-event="open" data-id="${esc(c.id)}">営業を確認</button><button class="quiet" data-info="${esc(c.id)}">店舗情報を確認</button>`:''}</div></details></article>`;
}

