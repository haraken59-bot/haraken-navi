// Public place data only. Matching never treats a chain name as a branch identifier.
export const distanceKm=(a,b)=>{const r=x=>x*Math.PI/180;return 12742*Math.asin(Math.sqrt(Math.sin(r(b.latitude-a.latitude)/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(r(b.longitude-a.longitude)/2)**2));};
export const officialStoreName=s=>['やきとり日高','やきとり ひだか','やきとりひだか'].includes(String(s||'').trim())?'やきとり ひだか':s;
export const normalizeName=s=>String(officialStoreName(s)||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
// A conservative time-of-day hint, not an opening-hours/calendar interpreter.
// If every published interval is outside the current time, reduce confidence.
export function outsidePublishedHours(c,now=new Date()){
 const text=String(c.hours||'').normalize('NFKC').replace(/[（(][^）)]*[）)]/g,'');
 if(/24時間|24\/7/.test(text))return false;
 const ranges=[...text.matchAll(/(\d{1,2}):(\d{2})\s*[～〜~-]\s*(翌)?(\d{1,2}):(\d{2})/g)];
 if(!ranges.length)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),minute=parts[0]*60+parts[1];
 return ranges.every(m=>{const start=Number(m[1])*60+Number(m[2]);let end=Number(m[4])*60+Number(m[5]);if(m[3]||end<=start)end+=1440;return ![minute,minute+1440].some(t=>t>=start&&t<end);});
}
const stem=s=>normalizeName(s).replace(/(?:本店|店)$/,'');
const phone=s=>String(s||'').replace(/\D/g,'');
export function samePlace(a,b){
 if(![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return false;
 const meters=distanceKm(a,b)*1000;if(meters>80)return false;
 if((/離れ/.test(a.name)!==/離れ/.test(b.name)))return false;
 const floor=x=>String(x.address||'').normalize('NFKC').match(/(\d+)\s*(?:階|F)/i)?.[1];
 if(floor(a)&&floor(b)&&floor(a)!==floor(b))return false;
 if(a.phone&&b.phone&&phone(a.phone)!==phone(b.phone))return false;
 const names=normalizeName(a.name)===normalizeName(b.name)||(stem(a.name).length>=3&&stem(a.name)===stem(b.name));
 return names||Boolean(phone(a.phone).length>=9&&phone(a.phone)===phone(b.phone)&&meters<=40);
}
export function mergeExternal(osm=[],hotpepper=[]){
 const possible=hotpepper.map(h=>osm.filter(o=>samePlace(h,o))),used=new Set(),out=[];
 for(let i=0;i<hotpepper.length;i++){
  const h=hotpepper[i],matches=possible[i],o=matches[0];
  if(matches.length===1&&possible.filter(xs=>xs.some(x=>x.id===o.id)).length===1){
   used.add(o.id);out.push({...o,...h,id:o.id,aliases:[o.name,h.name],source_kind:'both',source:'OpenStreetMap / ホットペッパー',sources:['osm','hotpepper'],osm_id:o.osm_id,osm_url:o.source_url,osm_hours:o.hours,tags:[...new Set([...(o.tags||[]),...(h.tags||[])])],hours:h.hours||o.hours,source_details:{osm:{fetched_at:o.observed_at,url:o.source_url},hotpepper:{fetched_at:h.observed_at,url:h.source_url}},match_confidence:'店名等・80m以内の一対一照合'});
  }else out.push({...h,match_confidence:matches.length?'照合不確実：別店舗として保持':'未照合'});
 }
 return [...out,...osm.filter(o=>!used.has(o.id)).map(o=>({...o,source_kind:'osm',sources:['osm']}))];
}
export function priceDetails(c,ctx={},now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(now));
 const period=ctx.mode==='drink'?'dinner':hour>=11&&hour<15?'lunch':hour>=17&&hour<24?'dinner':'unknown';
 const rows=(c.personal_prices||[]).filter(p=>Number.isFinite(p.amount)&&p.amount>=0).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
 const chosen=rows.find(p=>p.period===period)||rows[0];
 const labels=[];let value=null,confidence=0,at=null,source='unknown';
 if(chosen){value=chosen.amount;at=chosen.at;source='personal_history';confidence=chosen.period===period?1:0.75;labels.push(`本人${chosen.period==='lunch'?'ランチ':chosen.period==='dinner'?'夕食・飲み':''}実績：約${value.toLocaleString()}円`);}
 else if(c.price!=null&&Number.isFinite(Number(c.price))){value=Number(c.price);at=c.price_observed_at||c.observed_at;source='personal_or_manual';confidence=0.75;labels.push(c.kind==='action'&&value===0?'支出なし':`記録・入力時の目安：約${value.toLocaleString()}円`);}
 const hp=c.hotpepper;
 if(hp?.budget_name)labels.push(`ディナー目安：${hp.budget_name}`);
 if(hp?.budget_average)labels.push(`HP平均予算：${hp.budget_average}`);
 if(value==null&&hp){const m=String(hp.budget_name||'').normalize('NFKC').replaceAll(',','').match(/(\d+)\s*[～〜~-]\s*(\d+)円/);if(m){value=(Number(m[1])+Number(m[2]))/2;source='hotpepper_dinner';confidence=period==='dinner'?0.7:0.2;at=hp.fetched_at;}}
 return {value,confidence,source,at,period,labels:labels.length?labels:['予算未確認'],comparable:value!=null&&confidence>=0.5};
}
