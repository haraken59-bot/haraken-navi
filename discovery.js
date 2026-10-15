import {samePlace,normalizeName,mergeExternal,validPoint,withinSearch} from './places.js';
import {candidatesFromCloud} from './domain.js';
import {learningRecords} from './storage.js';
function mealPeriod(date){if(!date)return 'unknown';const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(new Date(date)));return h>=11&&h<15?'lunch':h>=17?'dinner':'unknown';}
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s・]/g,'');
export function km(a,b){const r=x=>x*Math.PI/180;return 12742*Math.asin(Math.sqrt(Math.sin(r(b.latitude-a.latitude)/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(r(b.longitude-a.longitude)/2)**2));}
function inArea(c,discovery,area){if(!discovery)return false;if(discovery.center&&Number.isFinite(c.latitude)&&Number.isFinite(c.longitude))return km(c,discovery.center)<=discovery.radius_m/1000;return Boolean(area&&c.area&&norm(c.area).includes(norm(area)));}
// Identical chain names alone must not link records from a different area/branch.
function sameLocalStore(a,b,discovery,area){if(a.store_id&&b.store_id)return a.store_id===b.store_id;if(Number.isFinite(a.latitude)&&Number.isFinite(b.latitude))return samePlace(a,b);if(![a.name,...(a.aliases||[])].some(n=>normalizeName(n)===normalizeName(b.name)))return false;if(Number.isFinite(a.latitude)&&Number.isFinite(b.latitude))return km(a,b)<0.15;return inArea(b,discovery,area);}
export function buildPool(discovery,cloud,records,local,ctx){
 const known=[...candidatesFromCloud(cloud),...learningRecords(records).map(r=>({id:'record:'+r.id,name:r.store_name,dish:r.dish_name,kind:r.kind||'store',mode:r.context?.mode||'eat',area:r.context?.area||'',tags:r.tags||[],price:r.amount_jpy,satisfaction:r.satisfaction,observed_at:r.created_at,meal_period:r.context?.meal_period||mealPeriod(r.created_at),source:'ナビの本人記録',confidence:'本人確定',visited:true}))];
 const sources=[...(discovery?.candidates||[]),...local.filter(c=>inArea(c,discovery,ctx.area)),...known.filter(c=>inArea(c,discovery,ctx.area))],pool=[];
 const externalIds=new Set((discovery?.candidates||[]).map(c=>c.id));
 for(const raw of sources){if(raw.kind!=='store')continue;if(pool.some(c=>c.id===raw.id||(!(externalIds.has(c.id)&&externalIds.has(raw.id))&&sameLocalStore(c,raw,discovery,ctx.area))))continue;
  const history=known.filter(k=>sameLocalStore(raw,k,discovery,ctx.area)),latest=history.sort((a,b)=>String(b.observed_at||'').localeCompare(String(a.observed_at||'')))[0];
  const supplement=local.find(k=>sameLocalStore(raw,k,discovery,ctx.area));
  const c={source_kind:raw.source_kind||'personal_history',sources:raw.sources||['personal_history'],...raw,...(supplement||{}),id:raw.id,search_scoped:true,visited:history.length>0||raw.visited===true,is_new:history.length===0&&!raw.visited};
  if(latest){if(raw.discovered)c.genre_external={...raw};c.personal_prices=history.filter(h=>h.price!=null&&Number.isFinite(Number(h.price))).map(h=>({amount:Number(h.price),at:h.observed_at,period:h.meal_period||mealPeriod(h.observed_at)}));c.history_observed_at=latest.observed_at;c.price_observed_at=latest.observed_at;c.tags=[...new Set([...(c.tags||[]),...(latest.tags||[])])];c.store_id=latest.store_id;c.satisfaction=latest.satisfaction;c.price=latest.price??raw.price;c.observed_at=raw.observed_at||latest.observed_at;c.history_source=latest.source;c.history_dish=latest.dish;c.dish=latest.dish?latest.dish+'（過去の記録・現在の提供は要確認）':raw.dish;}
  pool.push(c);
 }
 return discovery?.center?withinSearch(pool,discovery.center,discovery.radius_m):pool;
}
export function scopeKey(ctx){return validPoint(ctx.location)?`gps:${ctx.location.latitude}:${ctx.location.longitude}`:ctx.area.trim()?`area:${ctx.region||''}:${ctx.area.trim()}:${ctx.placeIndex??''}`:'';}
// API coordinates define the search area; its display label is not an area filter.
export function guestPool(data){return withinSearch((data?.candidates||[]).filter(c=>c.discovered&&['hotpepper','known_store'].includes(c.source_kind)),data?.center,data?.radius_m).map(c=>({...c,search_scoped:true}));}
export function searchHint(value){return String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N}\sー]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60);}
// A late response from a previous area must never replace the new area's pool.
const CACHE_KEY='haraken-discovery-cache-v1',FRESH=30*60*1000,MAX_AGE=7*86400000;
// Shared request contract for the current Node route and a future Edge transport.
// Personal history, owner IDs and satisfaction never enter search parameters.
export function discoveryParams(ctx){
 const params=new URLSearchParams();
 const hint=searchHint(ctx.desire);if(hint)params.set('hint',hint);
 if(validPoint(ctx.location)){params.set('latitude',ctx.location.latitude);params.set('longitude',ctx.location.longitude);}
 else if(ctx.area?.trim()){params.set('area',ctx.area.trim());params.set('region',ctx.region||'');if(ctx.placeIndex!=null)params.set('placeIndex',ctx.placeIndex);}
 if(['near','cheap','adventure','sure'].includes(ctx.direction))params.set('direction',ctx.direction);
 if(ctx.budget!=null&&ctx.budget!=='')params.set('budget',String(ctx.budget));
 params.set('category',ctx.category||'おまかせ');params.set('portion',ctx.portion||'');params.set('mealMode',ctx.mode||'eat');
 if(ctx.budget!=null)params.set('budget',ctx.budget);
 return params;
}
// Authenticated Edge transport. No provider keys or local-server fallback.
export function edgeDiscoveryTransport(endpoint,getToken,request=fetch){
 const target=new URL(endpoint);if(target.protocol!=='https:')throw Error('invalid_endpoint');
 return async (url,options={})=>{const source=new URL(url,'https://local.invalid');const out=new URL(target);out.search=source.search;out.searchParams.set('mode','discover');
   let token;try{token=await getToken();}catch{throw Error('ログインし直してから検索してください。');}
   if(!token)throw Error('ログインしてから検索してください。');
   let response;try{response=await request(out,{...options,headers:{Authorization:'Bearer '+token},redirect:'error'});}
   catch{throw Error('店舗検索に接続できません。時間をおいて再検索してください。');}
   if(!response.ok)throw Error(response.status===401||response.status===403?'ログインし直してから検索してください。':'店舗検索を利用できません。時間をおいて再検索してください。');
   return response;
 };
}
// Guest calls carry no JWT, cookies or owner inputs. No local Node fallback.
export function guestDiscoveryTransport(endpoint,request=fetch){
 const target=new URL(endpoint);if(target.protocol!=='https:')throw Error('invalid_endpoint');
 const allowed=new Set(['area','region','latitude','longitude','placeIndex','direction','category','portion','budget','mealMode','hint']);
 return async(url,options={})=>{
  const source=new URL(url,'https://local.invalid'),out=new URL(target);out.search='';
  for(const [key,value] of source.searchParams)if(allowed.has(key))out.searchParams.set(key,value);
  out.searchParams.set('mode','guest-discover');
  try {const response=await request(out,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:options.signal});
   if(!response.ok)throw Error('unavailable');return response;
  }catch{throw Error('店舗検索を利用できません。時間をおいて再検索してください。');}
 };
}
export class DiscoveryController{
 constructor(request=(...args)=>globalThis.fetch(...args),storage=null,now=()=>Date.now()){this.request=request;this.storage=storage;this.now=now;this.saved={};try{this.saved=JSON.parse(storage?.getItem(CACHE_KEY)||'{}');}catch{}if(!this.saved||typeof this.saved!=='object'||Array.isArray(this.saved))this.saved={};this.key='';this.value=null;this.version=0;this.pending=null;}
 reset(){this.version++;this.key='';this.value=null;this.pending=null;}
 remember(key,data){this.saved[key]=data;this.saved=Object.fromEntries(Object.entries(this.saved).filter(([,v])=>this.valid(v)).sort((a,b)=>Date.parse(b[1].fetched_at)-Date.parse(a[1].fetched_at)).slice(0,12));if(this.storage){for(;;){try{this.storage.setItem(CACHE_KEY,JSON.stringify(this.saved));break;}catch{const keys=Object.keys(this.saved);if(keys.length<=1)break;delete this.saved[keys[keys.length-1]];}}}}
 valid(v){return v&&Array.isArray(v.candidates)&&v.center&&Number.isFinite(v.center.latitude)&&Number.isFinite(v.center.longitude)&&Number.isFinite(Date.parse(v.fetched_at))&&this.now()-Date.parse(v.fetched_at)<MAX_AGE&&v.candidates.every(c=>!c.hotpepper||this.now()-Date.parse(c.hotpepper.fetched_at)<86400000);}
 recover(data,old){if(!data.source_data||!old?.source_data)return data;const sources={...data.source_data};let reused=false;for(const kind of ['osm','hotpepper']){const v=old.source_data[kind];if(!sources[kind]&&v&&this.now()-Date.parse(v.fetched_at)<(kind==='hotpepper'?86400000:MAX_AGE)){sources[kind]=v;reused=true;}}if(!reused)return data;return {...data,source_data:sources,candidates:mergeExternal(sources.osm?.candidates,sources.hotpepper?.candidates),from_cache:true,degraded:true,warning:(data.warning||'')+' 保存情報を併用しています。最新情報ではない可能性があります。'};}
 async search(ctx){const variant=':adaptive-v1:'+JSON.stringify([ctx.direction||'',ctx.category||'おまかせ',ctx.portion||'',ctx.budget??null,ctx.mode||'eat',searchHint(ctx.desire)]);const key=scopeKey(ctx)+variant,base=scopeKey({...ctx,placeIndex:undefined})+variant;
  const matchesCenter=data=>!validPoint(ctx.location)||validPoint(data?.center)&&km(ctx.location,data.center)<0.001;
  if(this.value&&!matchesCenter(this.value))this.value=null;
  if(key&&this.key===key&&this.value&&!this.value.degraded&&(this.value.needs_choice||this.now()-Date.parse(this.value.fetched_at)<FRESH))return this.value;
  if(key&&this.key===key&&this.pending)return this.pending;const version=++this.version;this.key=key;this.value=null;
  const params=discoveryParams(ctx);
  const promise=(async()=>{try{
   const response=await this.request('/api/discover?'+params,{signal:AbortSignal.timeout(30000)});let data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'店舗を探索できませんでした。'),{stage:data.stage,center:data.center});
   if(version!==this.version)return null;if(!matchesCenter(data))throw Error('検索中心を確認できません。もう一度検索してください。');data=this.recover(data,matchesCenter(this.saved[key])?this.saved[key]:null);this.value=data;if(!data.needs_choice&&this.valid(data)){this.remember(key,data);this.remember(base,data);}return data;
  }catch(e){if(version!==this.version)return null;const old=this.saved[key]||(ctx.placeIndex==null?this.saved[base]:null);
   const cached=this.valid(old)&&matchesCenter(old)?old:null;this.value={...(cached||{candidates:[],center:validPoint(ctx.location)?ctx.location:e.center||null,radius_m:1200}),degraded:true,from_cache:Boolean(cached),stage:e.stage||'店舗検索',error:e.message,warning:cached?'保存済みの探索結果を使用しています。最新情報ではない可能性があります。':'外部探索に失敗しました。同エリアの履歴・手動登録から候補を探しています。'};return this.value;
  }finally{if(version===this.version)this.pending=null;}})();this.pending=promise;return promise;
 }
}
