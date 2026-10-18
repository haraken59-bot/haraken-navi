import {distanceKm} from '../places.js';
export function normalizeHotpepper(shops,center,{now=new Date(),shochu=null,sake=null,radius_m=1200}={}){
 return shops.filter(s=>s.id&&s.name&&s.lat!==''&&s.lng!==''&&s.lat!=null&&s.lng!=null&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))&&distanceKm(center,{latitude:Number(s.lat),longitude:Number(s.lng)})<=radius_m/1000).map(s=>{
  const text=[s.genre?.name,s.genre?.catch,s.sub_genre?.name,s.catch].filter(Boolean).join(' '),tags=[s.genre?.name,s.sub_genre?.name].filter(Boolean);
  for(const [pattern,label] of [[/寿司|すし|鮨/,'寿司'],[/海鮮|刺身|魚料理/,'魚'],[/中華|餃子|炒飯/,'中華'],[/定食/,'定食'],[/焼肉|焼鳥|焼き鳥|ステーキ/,'肉'],[/ラーメン|うどん|そば/,'麺']])if(pattern.test(text))tags.push(label);
  const genre=s.genre?.name||'',bar=/バー|カラオケ/.test(genre),drink=/居酒屋|ダイニングバー|バー/.test(genre);
  return {meal_evidence:[s.genre?.catch,s.sub_genre?.name,s.catch].filter(Boolean).join(' '),id:'hotpepper:'+s.id,hotpepper_id:s.id,name:s.name,latitude:Number(s.lat),longitude:Number(s.lng),address:s.address||'',kind:'store',mode:bar&&!/ダイニング/.test(genre)?'drink':drink?'both':'eat',tags:[...new Set(tags)],dish:genre?genre+'（具体的な料理は要確認）':'料理は要確認',price:null,satisfaction:null,visited:false,is_new:true,discovered:true,source_kind:'hotpepper',sources:['hotpepper'],source:'ホットペッパー',source_url:/^https?:\/\//.test(s.urls?.pc||'')?s.urls.pc:null,hours:s.open||null,area:center.label,observed_at:now.toISOString(),confidence:'掲載情報・当日の営業と実支払額は要確認',hotpepper:{id:s.id,genre:s.genre?.name||null,sub_genre:s.sub_genre?.name||null,budget_name:s.budget?.name||null,budget_average:s.budget?.average||null,open:s.open||null,close:s.close||null,lunch:s.lunch||null,free_drink:s.free_drink||null,free_food:s.free_food||null,shochu_rich:shochu?shochu.has(s.id):null,sake_rich:sake?sake.has(s.id):null,url:s.urls?.pc||null,fetched_at:now.toISOString()}};
 });
}
// Every request is serialized; only public coordinates and flags are sent upstream.
export function createHotpepperService({key,request=globalThis.fetch.bind(globalThis),now=()=>Date.now(),budgetMs=18000,spacingMs=1100}={}){
 const cache=new Map(),pending=new Map();let queue=Promise.resolve(),last=0;
 async function call(params,deadline){const job=queue.then(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   if(now()>=deadline)throw Error('Hot Pepper 時間切れ');
   await new Promise(r=>setTimeout(r,Math.max(0,last+spacingMs-now())));if(now()>=deadline)throw Error('Hot Pepper 時間切れ');last=now();
   const u=new URL('https://webservice.recruit.co.jp/hotpepper/gourmet/v1/');u.search=new URLSearchParams({...params,key,format:'json',count:'100',datum:'world'});
   let status;try{const response=await request(u,{signal:AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-now()))),redirect:'error'});status=response.status;
    if(!response.ok)throw Error();const data=await response.json();if(data.results?.error||!Array.isArray(data.results?.shop))throw Error();return data.results;
   }catch{if(attempt===0&&(status==null||[408,502,503,504].includes(status))&&now()<deadline)continue;throw Error('Hot Pepper '+(status?'HTTP '+status:'通信失敗・時間切れ'));}
  }
 });queue=job.catch(()=>{});return job;}
 async function pages(center,deadline,flags={}){const shops=new Map();let complete=false;try{
  for(let start=1;start<=1000;){const d=await call({lat:String(center.latitude),lng:String(center.longitude),range:'4',start:String(start),...flags},deadline);for(const s of d.shop)shops.set(s.id,s);start+=d.shop.length;if(start>Number(d.results_available)){complete=true;break;}if(!d.shop.length)break;}
 }catch(e){if(!shops.size)throw e;}return {shops:[...shops.values()],complete};}
 return async center=>{if(!key)throw Error('Hot Pepper キー未設定');const id=`${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}`,old=cache.get(id);
  if(old&&now()-Date.parse(old.fetched_at)<1800000&&!old.partial)return old;
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{try{const deadline=now()+budgetMs,base=await pages(center,deadline);let shochu=null,sake=null;
   for(const flag of ['shochu','sake']){if(now()>=deadline)break;try{const d=await pages(center,deadline,{[flag]:'1'});if(d.complete){const ids=new Set(d.shops.map(s=>s.id));if(flag==='shochu')shochu=ids;else sake=ids;}}catch{break;}}
   const value={candidates:normalizeHotpepper(base.shops,center,{now:new Date(now()),shochu,sake}),fetched_at:new Date(now()).toISOString(),partial:!base.complete,alcohol_complete:Boolean(shochu&&sake)};
   cache.set(id,value);if(cache.size>30)cache.delete(cache.keys().next().value);return value;
  }catch(e){if(old&&now()-Date.parse(old.fetched_at)<86400000)return {...old,from_cache:true,warning:'Hot Pepperの保存情報を使用。最新情報ではない可能性があります。'};throw e;}finally{pending.delete(id);}})();pending.set(id,job);return job;
 };
}
