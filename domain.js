import {wantsOutside} from './action-options.js';
import {genreFit,requestedGenre,genreStrength} from './genre-fit.js';
import {hidakaContext} from './hidaka-context.js';
import {priceDetails,distanceKm,outsidePublishedHours} from './places.js';
import {learningRecords} from './storage.js';
export const DEFAULT_CONTEXT={mode:'eat',desire:'',category:'おまかせ',portion:'',budget:null,minutes:null,transport:'walk',weather:'unknown',occasion:'normal',companions:1,soloWish:3,socialWish:3,round:1,returnBy:'',tomorrow:'',direction:'',area:'',region:'福岡市'};
export function japanDay(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(now);}
export function weekday(now=new Date()){return new Date(now.toLocaleString('en-US',{timeZone:'Asia/Tokyo'})).getDay();}
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
const families=[['チャーハン','炒飯','やきめし'],['回転寿司','廻るすし','寿司','すし','鮨'],['海鮮丼','刺身','海鮮','魚'],['ラーメン','らーめん'],['麺','そば','うどん','ラーメン','らーめん'],['肉','焼肉','焼き鳥','やきとり','唐揚げ'],['中華','チャーハン','炒飯','やきめし','餃子'],['軽め','軽く','少量'],['ガッツリ','大盛','たっぷり']];
export function desireMatch(c,ctx,options={}){const hay=norm([c.name,c.dish,...(c.tags||[])].join(' ')),q=norm(ctx.desire|| (ctx.category==='おまかせ'?'':ctx.category));if(!q)return 0;

 if(/食べない|飲まない/.test(q))return c.id==='skip'?4:0;
 if(/まだ決めない|後で決め/.test(q))return c.id==='wait'?4:0;
 if(/家で|自宅で/.test(q))return c.id==='home'?4:0;
 const genre=requestedGenre(ctx);if(genre&&c.kind!=='action'){const fit=options.fit||genreFit(c,genre,options);const strength=genreStrength(fit),specific=q.replace(/今日も|今日は|が食べたい|を食べたい|食べたい|にしたい|がいい|が飲みたい/g,'');return strength+(strength&&specific!==genre&&fit.evidence.some(e=>e.source!=='name'&&norm(e.text).includes(specific))?0.25:0);}
 const literal=q.replace(/今日も|今日は|が食べたい|を食べたい|食べたい|にしたい|がいい|が飲みたい/g,'');
 if(literal&&hay.includes(literal))return 3;
 for(const group of families){if(group.some(x=>q.includes(norm(x)))&&group.some(x=>hay.includes(norm(x))))return group.length<=4?2:1;}
 return 0;
}
export function trustedValue(row,key){if(Object.hasOwn(row.confirmed_values||{},key))return row.confirmed_values[key];return row[key];}
export function provenance(row,key){return Object.hasOwn(row.confirmed_values||{},key)?'本人確定':row.field_provenance?.[key]?.state==='estimated'?'推定':'確度未確認';}
export function ageFactor(date,days,now=new Date()){if(!date)return 0.5;const age=(now-new Date(date))/86400000;return Number.isFinite(age)?Math.pow(0.5,Math.max(0,age)/days):0.5;}
export function candidatesFromCloud(cloud){const rows=cloud.history?.data?.records||[],map=new Map();
 for(const r of rows){if(r.is_test===true||r.exclude_from_learning===true||r.use_for_learning===false)continue;const name=trustedValue(r,'store_name')||r.store_name,dish=trustedValue(r,'dish_name');if(!name)continue;const key=(r.store_id||name)+'|'+(dish||'');if(map.has(key))continue;
 map.set(key,{id:'meal:'+key,store_id:r.store_id,name,dish:dish||'料理未確認',tags:[trustedValue(r,'genre'),trustedValue(r,'category')].filter(Boolean),mode:r.drink_status==='あり'?'both':'eat',price:trustedValue(r,'amount_jpy'),satisfaction:provenance(r,'satisfaction')==='本人確定'?trustedValue(r,'satisfaction'):null,source:'食事履歴',observed_at:r.eaten_at,confidence:provenance(r,'dish_name'),area:r.area||'',latitude:r.latitude,longitude:r.longitude,kind:'store',is_new:false});}
 const h=cloud.hidaka?.data;if(h?.store){const orders=h.recent_orders||[],ratings=orders.map(x=>x.feedback?.satisfaction).filter(Number.isFinite);map.set('hidaka',{id:'hidaka',store_id:h.store.id,name:h.store.name,dish:(h.current_menu||[]).filter(x=>x.is_orderable).slice(0,3).map(x=>x.name).join('・')||'メニューは日高オーダーで確認',tags:['焼き鳥','飲み'],mode:'drink',kind:'store',price:orders[0]?.total_amount??null,satisfaction:ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:null,observed_at:h.snapshot_at||h.generated_at,source:'日高オーダーの保存済み履歴',confidence:h.history_source==='direct_records_preferred'?'確定注文優先（メニューは保存時点）':'バックアップ時点',hidaka_context:cloud.hidaka.context||hidakaContext(h),bottles:h.bottle_status?.bottles||[],app:'hidaka'});}
 for(const b of cloud.shochu?.data||[]){const existing=[...map.values()].find(c=>c.store_id===b.store_id&&c.mode==='drink');if(existing){existing.bottles=[...(existing.bottles||[]).filter(x=>x.id!==b.bottle_id),{id:b.bottle_id,brand:b.brand,remaining_percent:b.remaining_percent}];Object.assign(existing,{closed_weekdays:b.closed_weekdays,latitude:b.latitude,longitude:b.longitude});continue;}
 const id='shochu:'+b.store_id,old=map.get(id);if(old){old.bottles.push(b);continue;}map.set(id,{id,store_id:b.store_id,name:b.store_name,dish:'キープのある店でゆっくり',tags:['飲み'],mode:'drink',kind:'store',price:null,source:'焼酎キープ帖',confidence:'参照時点',observed_at:new Date().toISOString(),area:b.area,closed_weekdays:b.closed_weekdays,latitude:b.latitude,longitude:b.longitude,bottles:[b],app:'shochu'});}
 return [...map.values()];
}
export const EXAMPLES=[
 {id:'ex-seika',name:'晴華楼',dish:'やきめし',price:800,satisfaction:4,tags:['中華','チャーハン'],mode:'eat'},
 {id:'ex-kukai',name:'喰海',dish:'肉そば',price:1250,satisfaction:3,tags:['肉','麺','そば'],mode:'eat'},
 {id:'ex-uotatsu',name:'魚辰',dish:'寿司・魚料理（内容要確認）',tags:['寿司','魚'],mode:'eat'},
 {id:'ex-sushi',name:'廻るすし市場',dish:'回転寿司',price:3230,satisfaction:4,tags:['寿司','魚'],mode:'eat'},
 {id:'ex-hidaka',name:'日高',dish:'料理は日高オーダーで確認',price:2618,satisfaction:5,tags:['焼き鳥','飲み'],mode:'drink',app:'hidaka'}
].map(c=>({...c,kind:'store',source:'会話の実地例（テスト専用）',confidence:'現在情報未確認',observed_at:null,is_test:true}));

export function normalizeConditions(ctx){return ['軽め','ガッツリ'].includes(ctx.category)?{...ctx,category:'おまかせ',portion:ctx.portion||ctx.category}:{...ctx,portion:ctx.portion||''};}
export function toggleCondition(ctx,axis,value){const next=normalizeConditions(ctx);next[axis]=next[axis]===value?(axis==='category'?'おまかせ':''):value;return next;}
export function portionFit(c,portion){
 const text=[c.dish,...(c.tags||[]),c.meal_evidence||'',c.name].join(' ');
 const hearty=/定食|焼肉|ステーキ|とんかつ|ハンバーグ|唐揚げ|丼|カレー|ラーメン|ちゃんぽん|中華|食堂|大盛|ボリューム|肉料理|揚げ物|ハンバーガー|プレート|しっかり/.test(text);
 const light=/ドーナツ|ドーナッツ|スイーツ|デザート|タピオカ|喫茶|コーヒー|菓子|軽食|カフェ/.test(text)||c.amenity==='cafe';
 if(portion==='ガッツリ')return hearty?'fit':light?'unsuitable':'unknown';
 if(portion==='軽め')return /軽め|少量|小さめ|そば|うどん/.test(text)||light?'fit':'unknown';
 return 'neutral';
}

export function actionCandidates(ctx){const drink=ctx.mode==='drink';return [
 {id:'home',name:drink?'家でまったり':ctx.portion==='ガッツリ'?'家でしっかり食べる':'家で軽く食べる',dish:drink?'外出せず、ゆっくり過ごす':ctx.portion==='ガッツリ'?'家で用意できる十分な食事を確認':'家にあるもので軽めに',tags:[ctx.portion==='ガッツリ'?'しっかり':'軽め'],price:null},
 {id:'wait',name:'まだ決めない',dish:'欲求がはっきりしてから考える',tags:[],price:0},
 {id:'skip',name:drink?'今は飲まない':'今は食べない',dish:'今の気分を優先する',tags:[],price:0},
 ...(ctx.occasion==='holiday'?[{id:'wander',name:ctx.area?ctx.area+'方面を少しブラブラ':'少しブラブラする',dish:'目的地は途中で決める',tags:[],price:null}]:[])
 ].map(c=>({...c,kind:'action',mode:ctx.mode,confidence:'行動の選択肢',source:'ナビ',travel_minutes:c.id==='home'||c.id==='wait'||c.id==='skip'?0:null}));}
function sameStore(a,b){if(a.discovered&&b.discovered&&a.id!==b.id)return false;if(a.store_id&&b.store_id)return a.store_id===b.store_id;if([a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite)&&distanceKm(a,b)>0.08)return false;return [a.name||a.store_name,...(a.aliases||[])].some(n=>norm(n)===norm(b.name||b.store_name));}
export function operating(c,events=[],now=new Date()){
 const e=events.filter(e=>(e.candidate_id===c.id||sameStore(c,e))&&japanDay(new Date(e.at))===japanDay(now)).sort((a,b)=>b.at.localeCompare(a.at))[0];
 if(e){const hours=(now-new Date(e.at))/3600000;if(e.status==='closed')return {available:false,label:'本日の休業を確認',certainty:0};if(e.status==='full'&&hours<2)return {available:false,label:'満席・行列（直近の確認）',certainty:0.1};if(e.status==='open'&&hours<4)return {available:true,label:'本日の営業を本人確認',certainty:0.95};}
 if(c.kind==='action')return {available:true,label:'店の営業確認は不要',certainty:1};
 if((c.closed_weekdays||[]).includes(weekday(now)))return {available:true,label:'基本定休日・当日の営業は未確認',certainty:0.2};
 if(outsidePublishedHours(c,now))return {available:true,label:'掲載営業時間の外の可能性・要確認',certainty:0.15,outside_hours:true};
 const fresh=ageFactor(c.hotpepper?.fetched_at||c.observed_at,30,now);return {available:true,label:c.hours?'掲載営業時間あり・当日の営業と空席は要確認':'当日の営業・空席は未確認',certainty:c.hours?0.45+0.2*fresh:0.4};
}
export function travelMinutes(c,ctx){if(c.kind==='action')return c.travel_minutes??null;if(c.travel_minutes!=null&&(!c.travel_mode||c.travel_mode===ctx.transport))return Number(c.travel_minutes);if(ctx.location&&Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)){
 const rad=x=>x*Math.PI/180,a=rad(ctx.location.latitude),b=rad(c.latitude),dl=rad(c.longitude-ctx.location.longitude),dlat=b-a;
 const km=6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2));return Math.ceil(km*1.4/(ctx.transport==='walk'?4:20)*60);}
 return null;}
// Inferred meal tendencies rank real candidates; they never create menus or stores.
export function mealTendencies(records,food,now=new Date()){
 const allowed=r=>r.is_test!==true&&r.use_for_learning!==false&&r.exclude_from_learning!==true;
 const local=learningRecords(records),remote=(food.meal_history||[]).filter(allowed);
 const recent=[...(food.recent7||[]),...(food.recent3||[]),...local].filter(allowed).filter(r=>!r.eaten_at&&!r.created_at||Date.parse(r.eaten_at||r.created_at)<=now);
 const unique=new Map();for(const r of recent){const key=r.id||[r.eaten_at||r.created_at,r.store_name,r.dish_name,r.genre,r.category].join('|');if(!unique.has(key))unique.set(key,r);}
 const latest=[...unique.values()].sort((a,b)=>String(b.eaten_at||b.created_at||'').localeCompare(String(a.eaten_at||a.created_at||''))).slice(0,7);
 const groups=['魚','肉','麺','中華','定食','寿司','軽め'];const categories=groups.map(label=>{
  const matches=r=>desireMatch({name:'',dish:trustedValue(r,'dish_name'),tags:[trustedValue(r,'genre'),trustedValue(r,'category'),...(r.tags||[])]},{desire:label,category:label})>0;
  const fav=(food.profile?.favorite_categories||[]).filter(x=>matches({genre:x.label})).reduce((sum,x)=>sum+Math.min(1,Math.max(0,Number(x.ratio)||0)),0);
  const satisfied=[...remote,...local].filter(r=>matches(r)&&Number(trustedValue(r,'satisfaction'))>=4).slice(0,20);
  const recent7=latest.filter(matches).length,recent3=latest.slice(0,3).filter(matches).length;
  const bias=food.bias?.signals||food.profile?.recent_bias?.signals||{};
  const score=Math.min(12,fav*12)+Math.min(12,satisfied.length*3)-recent7-recent3*2-(label==='麺'&&bias.noodle_streak?4:0)-(label==='肉'&&bias.meat_frequent?3:0);
  return {label,score,favorite:fav>0,satisfied:satisfied.length,recent7,recent3};
 });
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(now));
 return {categories,mealTime:hour>=11&&hour<15?'昼食':hour>=17&&hour<22?'夕食':null,hasHistory:latest.length+remote.length+local.length>0||categories.some(x=>x.favorite)};
}
function mealFit(c,t){
 const text=norm([c.name,c.dish,...(c.tags||[])].join(' ')),light=/ドーナツ|ドーナッツ|カフェ|コーヒー|喫茶|スイーツ|ケーキ|アイスクリーム/.test(text)||['cafe'].includes(c.amenity);
 const regular=/定食|食堂|寿司|すし|鮨|中華|炒飯|チャーハン|やきめし|ラーメン|うどん|そば|丼|焼肉|ステーキ|カレー|海鮮|パスタ|和食/.test(text);
 const matches=t.categories.filter(x=>desireMatch(c,{desire:x.label,category:x.label})>0);
 const preference=matches.length?matches.reduce((best,x)=>Math.abs(x.score)>Math.abs(best.score)?x:best,matches[0]):null;
 const base=regular?(t.mealTime?16:6):light?(t.mealTime?-18:-4):0;
 return {score:base+(preference?.score||0),reason:[t.mealTime&&regular?t.mealTime+'の通常食として比較':null,preference?.favorite?'本人の食事傾向を参考':null,preference?.satisfied?'満足度の高かった料理・ジャンルを参考':null,preference?.recent3?'直近の重複も考慮':null].filter(Boolean).join('・')};
}
export function recommend(candidates,ctx,records=[],food={},events=[],now=new Date()){
 ctx=normalizeConditions(ctx);
 const weights={fun:35,reliable:25,money:20,time:15,novel:5};if(ctx.occasion==='work'){weights.time+=20;weights.reliable+=15;}if(ctx.occasion==='holiday'){weights.fun+=10;weights.novel+=10;}if(ctx.direction==='cheap')weights.money+=60;if(ctx.direction==='near')weights.time+=65;if(ctx.weather==='bad')weights.time+=30;if(ctx.direction==='sure')weights.reliable+=35;if(ctx.direction==='adventure')weights.novel+=40;
 const learned=learningRecords(records),scored=[],tendencies=mealTendencies(records,food,now),omakase=ctx.mode==='eat'&&!ctx.desire.trim()&&ctx.category==='おまかせ';
 let maxMinutes=Number(ctx.minutes)||Infinity;if(ctx.returnBy){const [h,m]=ctx.returnBy.split(':').map(Number);const local=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));let remain=h*60+m-local.getHours()*60-local.getMinutes();if(remain<0)remain+=1440;maxMinutes=Math.min(maxMinutes,remain);}
 for(const c of [...candidates,...actionCandidates(ctx)]){
  if(ctx.storesOnly&&c.kind!=='store')continue;
  if(c.closed===true||c.permanently_closed===true)continue;
  if(c.kind==='store'&&ctx.location&&Number.isFinite(ctx.radius_m)&&[c.latitude,c.longitude].every(Number.isFinite)&&distanceKm(ctx.location,c)*1000>ctx.radius_m)continue;
  if(c.id==='home'&&wantsOutside(ctx))continue;
  if(c.mode!==ctx.mode&&c.mode!=='both')continue;if(!c.search_scoped&&ctx.area&&c.area&&!norm(c.area).includes(norm(ctx.area)))continue;
  const op=operating(c,events,now);if(!op.available)continue;
  const travel=travelMinutes(c,ctx),stay=c.kind==='action'?0:ctx.mode==='drink'?(ctx.round===2?40:70):30;
  if(c.kind==='store'&&travel!=null&&travel*2+stay>maxMinutes)continue;
  const genre_fit=genreFit(c,requestedGenre(ctx),{now,owner:ctx.owner,history:food.meal_history||[],historyOwner:food.history_owner});if(genre_fit?.level==='mismatch')continue;
  const match=desireMatch(c,ctx,{now,fit:genre_fit}),portion_fit=ctx.mode==='eat'?portionFit(c,ctx.portion):'neutral',past=learned.filter(r=>sameStore(c,r)&&(!r.dish_name||norm(r.dish_name)===norm(c.dish)));
  let rating=c.satisfaction??3,weight=1;for(const r of past){const w=ageFactor(r.created_at,365,now);rating+=r.satisfaction*w;weight+=w;}rating/=weight;
  const recentRows=[...(food.recent7||[]),...learned.map(r=>({eaten_at:r.created_at,dish_name:r.dish_name,genre:r.tags?.[0]}))].filter(r=>!r.eaten_at||new Date(r.eaten_at)<=now).sort((a,b)=>String(b.eaten_at||'').localeCompare(String(a.eaten_at||''))).slice(0,7);
  const familiarity=c.visited===true||past.length>0||c.satisfaction!=null;const recent=recentRows.filter(r=>[trustedValue(r,'genre'),trustedValue(r,'category')].some(x=>x&&(c.tags||[]).includes(x))||(r.dish_name&&norm(r.dish_name)===norm(c.dish)));
  const favorite=(food.profile?.favorite_categories||[]).filter(x=>(c.tags||[]).includes(x.label)).reduce((s,x)=>s+Math.min(Number(x.ratio)||0,1),0);
  const pricing=priceDetails(c,ctx,now),priceTrust=ageFactor(pricing.at,45,now)*pricing.confidence,priceScore=pricing.value==null?0.15:0.15+(Math.max(0,1-pricing.value/(Number(ctx.budget)||2500))-0.15)*priceTrust;
  const access=events.filter(e=>e.is_test!==true&&e.use_for_learning!==false&&(e.candidate_id===c.id||sameStore(c,e)));const failures=access.filter(e=>['full','closed'].includes(e.status)).reduce((n,e)=>n+ageFactor(e.at,14,now),0),entries=access.filter(e=>e.entered===true).reduce((n,e)=>n+ageFactor(e.at,90,now),0);
  const reliabilityAdjustment=ctx.direction==='sure'?Math.min(8,entries*3)-Math.min(16,failures*5)+(familiarity?6:0)+(c.hours?4:0)+(pricing.labels[0]!=='予算未確認'?2:0):0;
  let score=weights.fun*(rating/5)*ageFactor(c.observed_at,730,now)+weights.reliable*op.certainty+weights.money*priceScore+weights.time*(travel==null?0.2:Math.max(0,1-travel/40))+weights.novel*(familiarity?0.2:1)+favorite*5+reliabilityAdjustment;
  if(!match)score-=Math.min(recent.length*1.5,6);if(food.bias?.signals?.noodle_streak&&!match&&(c.tags||[]).includes('麺'))score-=2;
  const fit=omakase&&c.kind==='store'?mealFit(c,tendencies):{score:0,reason:''};score+=fit.score;if(op.outside_hours)score-=18;if(tendencies.mealTime==='昼食'&&/^なし/.test(c.hotpepper?.lunch||''))score-=18;
  if(ctx.direction==='sure'&&familiarity&&rating>=4)score+=18;
  if(ctx.direction==='adventure')score+=Math.max(0,12-recent.length*4)*(familiarity?0.25:1);
  if(ctx.budget&&pricing.value>ctx.budget)score-=20*pricing.confidence;
  if(Number.isFinite(maxMinutes)&&c.kind==='store'&&travel===null)score-=25;
  if(ctx.mode==='drink'){const desire=ctx.companions>1?ctx.socialWish:ctx.soloWish;if(c.kind==='store')score+=(desire-3)*18+(c.bottles?.length?8:0)-(ctx.tomorrow?8:0);if(c.id==='home')score+=(3-desire)*30+(ctx.tomorrow?15:0);}
  if(c.kind==='action')score-=55;if(c.id==='wait')score+=1;if(c.id==='wait'&&ctx.direction==='wait')score+=300;if(ctx.direction==='genre'&&recent.length)score-=18;
  if(!Number.isFinite(score))score=0;
  if(ctx.mode==='eat'&&ctx.portion==='軽め'&&c.id==='home')score+=65;
  scored.push({...c,match,genre_fit,portion_fit,score,pricing,distance_m:ctx.location&&Number.isFinite(c.latitude)?Math.round(distanceKm(ctx.location,c)*1000):null,score_parts:{price:weights.money*priceScore,time:weights.time*(travel==null?0.2:Math.max(0,1-travel/40)),certainty:weights.reliable*op.certainty+reliabilityAdjustment,novel:weights.novel*(familiarity?0.2:1)},meal_fit:fit,expectedSatisfaction:rating,travel,op,label:match?'今の気分に合いそう':familiarity?'安定候補':c.kind==='action'?'こんな過ごし方も':'新規開拓枠',reason:genre_fit?genre_fit.reason+(ctx.portion?'・'+ctx.portion+'の量は要確認':''):ctx.portion&&ctx.mode==='eat'?(portion_fit==='fit'?`${ctx.category==='おまかせ'?'':ctx.category+'・'}${ctx.portion}の条件に合う提供情報あり（量は要確認）`: '食事量への適合は情報不足・要確認'):match?'今の「食べたい・飲みたい」を優先':fit.reason?fit.reason:past.length?'学習対象の本人記録を参考にしました':c.satisfaction>=4?'過去の本人満足度が高い候補':c.bottles?.length?'キープボトルのある店':c.kind==='action'?'店に行く以外の選択肢も大切に':favorite?'記録された好みと共通点があります':'今の条件から比較する候補'});
 }
 const fitRank=c=>c.portion_fit==='fit'?2:c.portion_fit==='unsuitable'?0:1;
 const hasPortion=ctx.mode==='eat'&&Boolean(ctx.portion);
 if(hasPortion&&ctx.portion==='ガッツリ'&&!ctx.relaxPortion){for(let i=scored.length-1;i>=0;i--)if(scored[i].portion_fit==='unsuitable')scored.splice(i,1);}
 const explicit=Boolean(ctx.desire.trim()||ctx.category!=='おまかせ');scored.sort((a,b)=>(ctx.direction==='wait'?Number(b.id==='wait')-Number(a.id==='wait'):0)||(explicit?b.match-a.match:0)||(hasPortion?fitRank(b)-fitRank(a):0)||b.score-a.score||a.id.localeCompare(b.id));
 const unique=[];for(const c of scored)if(!unique.some(x=>x.kind==='store'&&c.kind==='store'&&sameStore(x,c)))unique.push(c);
 let top=unique.slice(0,3);if(ctx.direction!=='wait'){
  const fresh=c=>c.kind==='store'&&c.visited!==true&&!c.satisfaction&&!learned.some(r=>sameStore(c,r));
  const known=c=>c.kind==='store'&&(c.visited||c.satisfaction>=4);
  for(const predicate of [fresh,known]){if(top.some(predicate))continue;const alternate=unique.find(c=>predicate(c)&&(!hasPortion||fitRank(c)>=fitRank(top[2]||{}))&&(!explicit||c.match>0&&c.match>=(top[2]?.match||0)));if(alternate&&alternate.score>=(top[2]?.score??0)-15)top[Math.min(2,top.length)]=alternate;}
 }
 const fallbackMatch=c=>explicit?c.match:(c.tags||[]).filter(t=>top[0]?.tags?.includes(t)).length;
 const fallback=unique.filter(c=>c.id!==top[0]?.id&&c.kind==='store').sort((a,b)=>fallbackMatch(b)-fallbackMatch(a)||(hasPortion?fitRank(b)-fitRank(a):0)||(omakase?(b.meal_fit?.score||0)-(a.meal_fit?.score||0):0)||(a.travel??999)-(b.travel??999)||b.expectedSatisfaction-a.expectedSatisfaction||b.op.certainty-a.op.certainty||b.score-a.score)[0]||unique.find(c=>c.id==='wait');
 return {portionInsufficient:hasPortion&&!scored.some(c=>c.kind==='store'&&c.portion_fit==='fit'&&(!explicit||c.match>0)),priceComparableCount:scored.filter(c=>c.kind==='store'&&c.pricing.comparable).length,ranked:unique,tendencies:omakase?tendencies:null,top,fallback:top[0]?.kind==='action'?null:fallback,weights,unmatched:explicit&&ctx.direction!=='wait'&&!top.some(c=>c.match),limitedTime:Number.isFinite(maxMinutes),generated_at:now.toISOString()};
}

// Preserve hard exclusions (mode, distance/time, confirmed closure, genre mismatch).
// Wishes are ranking hints; only the soft portion preference can be relaxed.
export function recommendSearch(candidates,ctx,records=[],food={},events=[],now=new Date()){
 let result=recommend(candidates,ctx,records,food,events,now);
 if(ctx.direction!=='wait'&&!result.top.some(c=>c.kind==='store')){
  const relaxed=recommend(candidates,{...ctx,storesOnly:true,relaxPortion:true},records,food,events,now);
  if(relaxed.top.length)result={...relaxed,searchFallback:true};
 }
 if(result.top.some(c=>c.kind==='store')&&result.unmatched)result.searchFallback=true;
 return result;
}

