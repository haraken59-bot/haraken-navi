import {photoLocation} from './importer/photo-location.js?v=20261030-gps-common-navi';
import {normalizeStoreName,validateRecords,hasValue} from './importer/records.js';
import {inferPeriod,emptyClassification} from './importer/domain.js';
import {validGps,distanceMeters} from './importer/locations.js';
export function gpsComparison(current,photo,store){
 const distance=(a,b)=>validGps(a)&&validGps(b)?Math.round(distanceMeters(a,b)):null;
 const distances={current_store_m:distance(current,store),photo_store_m:distance(photo,store),current_photo_m:distance(current,photo)};
 const accuracy=Math.max(100,Number(current?.accuracy_m)||0,Number(photo?.accuracy_m)||0);
 const comparison=distances.current_photo_m===null?'unknown':distances.current_photo_m<=accuracy?'near':distances.current_photo_m<=Math.max(1000,accuracy*3)?'check':'far';
 return {...distances,current_photo_status:comparison,near_threshold_m:accuracy,notes:[comparison==='near'?'写真の撮影場所と現在地は近い可能性があります':comparison==='check'?'写真と現在地が少し離れています。記録日時・場所を確認してください':comparison==='far'?'写真の撮影場所と現在地が離れています。帰宅後の記録ならそのまま保存できます':null,!photo?'写真GPSなし（保存できます）':null,distances.photo_store_m!==null?(distances.photo_store_m<=100?'写真は店舗付近で撮影された可能性があります':'写真と店舗の位置が離れています'):null,distances.current_store_m!==null?(distances.current_store_m<=100?'現在地は店舗付近です':'現在地は店舗から離れています。後からの記録もできます'):null].filter(Boolean)};
}
export function parseMealText(draft,text){
 const next={...draft},s=text.normalize('NFKC').trim();
 if(/^[1-5]$/.test(s))return {...next,satisfaction:Number(s)};
 const visit=s.match(/^(.+?)(?:へ|に)(?:行きました|行った|来ました)$/);
 if(visit)return {...next,store_name:visit[1].trim()};
 const dish=s.match(/^(.+?)\s+([0-9][0-9,]*)\s*円?$/);
 if(dish)return {...next,dish_name:dish[1].trim(),amount_jpy:Number(dish[2].replaceAll(',',''))};
 throw Error('「かちかち山へ行きました」「4」「ミックスフライ定食 880」のように入力してください。その他は下の項目へ入力できます。');
}
export function duplicateMeals(meal,history){
 const valid=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const fps=new Set((meal.images||[]).map(i=>i.fingerprint).filter(valid));
 if(!fps.size)return [];
 return history.filter(r=>r.id!==meal.id&&[...(r.images||[]),...(r.meal_images||[]),...(r.navi_metadata?.original_photos||[])].some(i=>fps.has(i.fingerprint||i.sha256)));
}
export function buildMeal(input,{id=crypto.randomUUID(),photos=[],current=null,store=null,decision=null,context={},isTest=false}={}){
 if(!input.eaten_at||!Number.isFinite(Date.parse(input.eaten_at)))throw Error('食事日時を入力してください。');
 if(input.satisfaction===''||input.satisfaction==null||!Number.isInteger(Number(input.satisfaction))||Number(input.satisfaction)<1||Number(input.satisfaction)>5)throw Error('満足度を1〜5で選んでください。');
 const eaten=input.eaten_at?new Date(input.eaten_at).toISOString():null;
 const number=(v)=>v===''||v==null?null:Number(v);
 const meal={...emptyClassification(),id,record_version:2,eaten_at:eaten,meal_period:inferPeriod(eaten),store_id:input.store_id||null,unlinked_store_name:input.store_id?null:input.store_name?.trim()||null,area:input.area?.trim()||null,dish_name:input.dish_name?.trim()||null,amount_jpy:number(input.amount_jpy),satisfaction:number(input.satisfaction),comment:input.comment?.trim()||null,genre:input.genre||'不明',source_type:'manual',source_reference:'haraken-navi',confirmed_values:{},field_provenance:{},created_at:new Date().toISOString(),images:photos.map(p=>({id:p.id,fingerprint:p.fingerprint,file_name:p.name,taken_at:p.taken_at,date_source:p.date_source,thumbnail:p.thumbnail})),analysis:photos.map(p=>({image_id:p.id,photo_location:p.gps||null,photo_location_provenance:photoLocation(p),file_info:{name:p.name,size:p.file.size,type:p.file.type},gps_diagnostic:p.gpsDiagnostic,meal_photo_time_difference_minutes:p.taken_at&&Number.isFinite(Date.parse(p.taken_at))?Math.round((Date.parse(eaten)-Date.parse(p.taken_at))/60000):null})),navi_metadata:{version:1,is_test:isTest,exclude_from_learning:isTest||input.exclude_from_learning===true,recommendation_location:validGps(decision?.context?.location)?decision.context.location:null,current_location:validGps(current)?current:null,photo_location:photos[0]?.gps||null,photo_locations:photos.map(p=>({image_id:p.id,location:p.gps||null,provenance:photoLocation(p)})),store_location:validGps(store)?store:null,gps_comparisons:photos.length?photos.map(p=>({image_id:p.id,...gpsComparison(current,p.gps,store)})):[gpsComparison(current,null,store)],context:decision?.revisions?.at(-1)?.context||decision?.context||context,recording_context:context,companion:input.companion?.trim()||null,decision_id:decision?.id||null,first_recommendation:decision?.first_recommendation||null,presented_candidates:decision?.presented_candidates||[],fallback:decision?.initial_fallback||decision?.fallback||null,initial_choice:decision?.initial_choice||null,latest_choice:decision?.latest_choice?structuredClone(decision.latest_choice):null,transitions:structuredClone(decision?.transitions||[]),actual_visit:input.store_name?.trim()||null,change_reason:input.change_reason||null}};

 for(const k of ['eaten_at','store_id','unlinked_store_name','area','dish_name','amount_jpy','satisfaction','comment','genre'])if(hasValue(meal[k])){meal.confirmed_values[k]=meal[k];meal.field_provenance[k]={state:'confirmed',origin:'user',confidence:null};}
 meal.field_provenance.meal_period={state:hasValue(meal.meal_period)?'estimated':'unknown',origin:'time_rule',confidence:null};meal.review_status='手動修正';
 validateRecords([meal]);return meal;
}
