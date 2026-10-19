import {adaptiveNearby} from './adaptive-search.mjs';
import { stageLogger } from './diagnostics.mjs';
import { knownPlace } from './known-places.mjs';
import { normalizeHotpepper } from '../../../app/scripts/hotpepper-service.mjs';
import { withinSearch } from '../../../app/places.js';
export function parseSearch(params) {
  const text = (key, max) => { const value=(params.get(key)||'').trim(); if(value.length>max)throw Error('invalid_search'); return value; };
  const number = (key,min,max) => { const raw=params.get(key); if(raw==null||raw==='')return null; const value=Number(raw); if(!Number.isFinite(value)||value<min||value>max)throw Error('invalid_search');return value; };
  const area=text('area',120),region=text('region',80);
  const hint=text('hint',120).normalize('NFKC').replace(/[^\p{L}\p{N}\sー]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60);
  const latitude=number('latitude',-90,90)??number('lat',-90,90),longitude=number('longitude',-180,180)??number('lng',-180,180);
  const gpsLatitude=number('gpsLatitude',-90,90),gpsLongitude=number('gpsLongitude',-180,180);
  if((latitude===null)!==(longitude===null)||(gpsLatitude===null)!==(gpsLongitude===null))throw Error('invalid_search');
  if(!area&&latitude===null&&gpsLatitude===null)throw Error('invalid_search');
  const direction=text('direction',12), category=text('category',12),portion=text('portion',12);
  if(!['','near','cheap','adventure','sure'].includes(direction)||!['','おまかせ','魚','肉','麺','中華','定食'].includes(category)||!['','軽め','ガッツリ'].includes(portion))throw Error('invalid_search');
  const placeIndex=number('placeIndex',0,2);if(placeIndex!==null&&!Number.isInteger(placeIndex))throw Error('invalid_search');
  return {photoStoreLookup:params.get('photoStoreLookup')==='1',hint,area,region,latitude,longitude,gpsLatitude,gpsLongitude,placeIndex,direction,category,portion,budget:number('budget',0,100000),mode:params.get('mealMode')==='drink'?'drink':'eat'};
}
// Keys contain only normalized provider inputs, never JWT, owner or personal history.
export async function cacheKey(provider, input) {
  const canonical=JSON.stringify(Object.keys(input).sort().map(key=>[key,input[key]]));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  return 'v1:'+provider+':'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export function createSearchService({state,readEnv,request=fetch,uuid=()=>crypto.randomUUID(),now=()=>Date.now(),log,knownStores=async()=>[],includeKnownStores=false,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  const stage=stageLogger(log);
  let lastProviderFinished=null;
  async function stateCall(method,...args) {
    try { const result=await state[method](...args);
      if(['acquire','finish','save'].includes(method)&&result===false)stage('lease_failed');
      return result;
    } catch (error) { stage(['cached','save'].includes(method)?'cache_failed':'lease_failed'); throw error; }
  }
  async function cachedCall(provider, input, ttl, load) {
    stage(provider==='nominatim'?'geocode_cache_check':'hotpepper_cache_check');
    const key=await cacheKey(provider,input),cached=await stateCall('cached',key);
    if(cached!==null){stage(provider==='nominatim'?'geocode_cache_hit':'hotpepper_cache_hit');return cached;}
    const id=uuid(),started=now();
    if(provider==='hotpepper'&&lastProviderFinished!==null)await sleep(Math.max(0,1100-(now()-lastProviderFinished)));
    if(!await stateCall('acquire',provider,id))throw Error('search_busy');
    stage(provider==='nominatim'?'nominatim_lease_acquired':'hotpepper_lease_acquired');
    let success=false;
    try {
      // Recheck after lease acquisition: another worker may have populated it.
      const again=await stateCall('cached',key);if(again!==null){stage(provider==='nominatim'?'geocode_cache_hit':'hotpepper_cache_hit');if(!await stateCall('finish',provider,id,true))throw Error('search_unavailable');success=true;return again;}
      if(now()-started>5000)throw Error('search_unavailable');
      let value;
      stage(provider==='nominatim'?'nominatim_request_started':'hotpepper_request_started');
      try { value=await load(); stage(provider==='nominatim'?'nominatim_request_ok':'hotpepper_request_ok'); }
      catch (error) { stage(provider==='nominatim'?'nominatim_request_failed':'hotpepper_request_failed'); throw error; }
      // Publish only while we still own a live lease; a stale worker cannot complete.
      if(!await stateCall('save',key,value,ttl,provider,id))throw Error('search_unavailable');
      success=true;if(provider==='hotpepper')lastProviderFinished=now();
      return value;
    } catch { throw Error('search_unavailable'); }
    finally { if(!success)await stateCall('finish',provider,id,false); }
  }
  async function json(url,headers={}) {
    const response=await request(url,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('search_unavailable');
    return response.json();
  }
  async function nominatimJson(url,headers) {
    const signal=AbortSignal.timeout(8000);
    let response;
    try { response=await request(url,{headers,redirect:'error',signal}); }
    catch {
      stage(signal.aborted?'nominatim_fetch_timeout':'nominatim_fetch_network_failed');
      throw Error('search_unavailable');
    }
    if(!response.ok) {
      stage('nominatim_http_non_ok');
      if(response.status===429)stage('nominatim_http_429');
      else if(response.status>=400&&response.status<500) {
        stage('nominatim_http_4xx');
        switch(response.status) {
          case 400: stage('nominatim_http_400'); break;
          case 401: stage('nominatim_http_401'); break;
          case 403:
            stage('nominatim_http_403');
            // Presence-only diagnostics; never read/log the provider body or header values.
            if(headers['User-Agent'])stage('nominatim_user_agent_header_set');
            if(headers.Accept)stage('nominatim_accept_header_set');
            if(response.headers?.get('content-type')?.includes('json'))stage('nominatim_response_content_type_json');
            else if(response.headers?.get('content-type')?.includes('text'))stage('nominatim_response_content_type_text');
            if(response.headers?.has('retry-after'))stage('nominatim_response_has_retry_after');
            break;
          case 404: stage('nominatim_http_404'); break;
          default: stage('nominatim_http_other_4xx');
        }
      }
      else if(response.status>=500&&response.status<600)stage('nominatim_http_5xx');
      throw Error('search_unavailable');
    }
    try {
      const data=await response.json();
      if(!Array.isArray(data))throw Error('search_unavailable');
      return data;
    } catch {
      stage(signal.aborted?'nominatim_fetch_timeout':'nominatim_response_parse_failed');
      throw Error('search_unavailable');
    }
  }
  return async input => {
    let center;
    if(input.latitude!=null&&input.longitude!=null)center={latitude:input.latitude,longitude:input.longitude,label:'指定座標周辺'};
    else if(input.gpsLatitude!=null&&input.gpsLongitude!=null)center={latitude:input.gpsLatitude,longitude:input.gpsLongitude,label:'GPSの現在地周辺'};
    else center=knownPlace(input.area,input.region);
    if(!center&&input.area) {
      const userAgent=readEnv('NAVI_NOMINATIM_USER_AGENT');
      if(!userAgent||!/^HarakenNavi\//.test(userAgent)||/[\r\n]/.test(userAgent)){stage('config_missing');throw Error('search_unavailable');}
      const q=input.area.includes(input.region)?input.area:[input.region,input.area].filter(Boolean).join(' ');
      const places=await cachedCall('nominatim',{q},86400,async()=>{
        const url=new URL('https://nominatim.openstreetmap.org/search');
        url.search=new URLSearchParams({q,format:'jsonv2',limit:'3',countrycodes:'jp','accept-language':'ja'});
        const data=await nominatimJson(url,{'User-Agent':userAgent,Accept:'application/json'});
        const results=data.slice(0,3).map(x=>({latitude:Number(x.lat),longitude:Number(x.lon),label:String(x.display_name||'').slice(0,500)})).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&Math.abs(x.latitude)<=90&&Math.abs(x.longitude)<=180);
        stage(results.length?'nominatim_response_ok':'nominatim_response_empty');
        return results;
      });
      if(!places.length) return {candidates:[],needs_choice:true,places};
      if(places.length>1&&input.placeIndex===null)return {needs_choice:true,places};
      center=places[input.placeIndex??0];if(!center)throw Error('invalid_search');
    }
    if(!center)throw Error('invalid_search');
    const key=readEnv('HOTPEPPER_API_KEY');if(!key){stage('config_missing');throw Error('search_unavailable');}
    let calls=0;const started=now();
    const value=await adaptiveNearby({input,center,knownStores:includeKnownStores?knownStores:async()=>[],includeKnownStores,now,load:async(radius,keyword)=>{
      const params={lat:String(center.latitude),lng:String(center.longitude),range:String({500:2,1000:3,2000:4,3000:5}[radius]),count:'100',start:'1',datum:'world',...(keyword?{keyword}:{})};
      return cachedCall('hotpepper',{...params,radius_m:radius,category:input.category||'',policy:'adaptive-v1'},1800,async()=>{
        if(calls>=6||now()-started>18000)throw Error('search_budget');
        const url=new URL('https://webservice.recruit.co.jp/hotpepper/gourmet/v1/');url.search=new URLSearchParams({...params,key,format:'json'});
        calls++;const data=await json(url);if(data.results?.error||!Array.isArray(data.results?.shop))throw Error('search_unavailable');
        return {candidates:normalizeHotpepper(data.results.shop,{...center,label:''},{radius_m:radius}),partial:Number(data.results.results_available)>data.results.shop.length,fetched_at:new Date(now()).toISOString()};
      });
    }});
    return {center,radius_m:value.radius_m,candidates:value.candidates.map(c=>({...c,area:center.label})),search_radii:value.search_radii,search_terms:value.search_terms,
      fetched_at:value.fetched_at,source_data:{hotpepper:value},source:'Hot Pepper',source_status:{hotpepper:'ok',osm:'not_requested'},
      pending:false,degraded:value.partial,truncated:value.partial,warning:value.partial?'取得上限または通信制限のため一部の店舗のみです。':'',
      ranking_context:{direction:input.direction,category:input.category,portion:input.portion,budget:input.budget,mode:input.mode}};
  };
}
