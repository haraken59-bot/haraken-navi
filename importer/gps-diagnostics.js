import {inspectJpegRefs} from './jpeg-ref-diagnostics.js?v=20261025-camera-gps';
import exifr from '../vendor/exifr.mjs';
import { validGps } from './locations.js';
function scalar(v) {
  if (typeof v==='number') return Number.isFinite(v)?v:null;
  if (Array.isArray(v)&&v.length===2) return ratio(v[0],v[1]);
  if (v&&typeof v==='object'&&'numerator' in v&&'denominator' in v) return ratio(v.numerator,v.denominator);
  return null;
}
function ratio(n,d){return typeof n==='number'&&typeof d==='number'&&Number.isFinite(n)&&Number.isFinite(d)&&d>0&&Number.isFinite(n/d)?n/d:null;}
function directionOf(ref){
 if(typeof ref==='number'&&[78,83,69,87].includes(ref))ref=String.fromCharCode(ref);
 if(Array.isArray(ref)||ArrayBuffer.isView(ref)){const a=Array.from(ref).slice(0,4);ref=a.every(x=>typeof x==='string')?a.join(''):a.every(x=>Number.isInteger(x)&&x>=0&&x<=255)?String.fromCharCode(...a):'';}
 return typeof ref==='string'?ref.replace(/\0/g,'').trim().toUpperCase():'';
}
export function coordinateDiagnostic(value,ref,axis){
 const direction=directionOf(ref),format=Array.isArray(value)?'配列('+value.length+')':ArrayBuffer.isView(value)?'型付き配列':value===null?'null':typeof value;
 const types=(Array.isArray(value)||ArrayBuffer.isView(value))?Array.from(value,x=>Array.isArray(x)?'有理数配列':x===null?'null':typeof x).join(','):format;
 const result=(value,stage)=>({value,stage,format:format+' / 要素型 '+types,ref:direction||'未検出'});
 if(!(axis==='lat'?['N','S']:['E','W']).includes(direction))return result(null,'Ref未検出・不正');
 let degrees;
 if((Array.isArray(value)||ArrayBuffer.isView(value))&&value.length===3){
  const [d,m,s]=Array.from(value,scalar);
  if([d,m,s].some(x=>x===null))return result(null,'度分秒の数値・分母が不正');
  if(d<0||m<0||m>=60||s<0||s>=60)return result(null,'度分秒の範囲が不正');
  degrees=d+m/60+s/3600;
 }else{degrees=scalar(value);if(degrees===null)return result(null,'数値形式・分母が不正');}
 if(degrees<0||degrees>(axis==='lat'?90:180))return result(null,'座標範囲が不正');
 return result(degrees*(['S','W'].includes(direction)?-1:1),'変換成功');
}
export function coordinate(value,ref,axis){return coordinateDiagnostic(value,ref,axis).value;}
function describe(value) {
  if (value === undefined) return 'なし';
  if (value === null) return '空(null)';
  if (Array.isArray(value)) return '[' + value.map(describe).join(', ') + ']';
  return String(value).slice(0,160);
}
export async function inspectGps(file, parser = exifr, originalBytes) {
  const diagnostic = { version: 'GPS診断1', input: '縮小前の元File', type: file.type || '不明', size: file.size, latitudeTag: false, longitudeTag: false, status: 'missing', error: null };
  let bytes;
  try { bytes = originalBytes ?? await file.arrayBuffer(); }
  catch { diagnostic.status='read_error'; return {gps:null,diagnostic}; }
  const directRefs=inspectJpegRefs(bytes);
  let fast = null, tags = null, fullFailed = false;
  try { fast = await parser.gps(bytes); } catch { diagnostic.error = 'GPS簡易解析でエラー'; }
  try {
    // Full original bytes avoid File/Blob chunk reader differences. Never parse Canvas output.
    tags = await parser.parse(bytes, { gps: true, translateKeys: true, translateValues: true, reviveValues: true, pick: ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'] });
    if (Array.isArray(tags?.errors) && tags.errors.length) { fullFailed=true; diagnostic.error='元ファイルのEXIF解析でエラー'; }
    diagnostic.latitudeTag = tags?.GPSLatitude !== undefined;
    diagnostic.longitudeTag = tags?.GPSLongitude !== undefined;
  } catch { fullFailed = true; diagnostic.error = '元ファイルのGPSタグ解析でエラー'; }
  // Only inspect the GPS IFD: numeric 1/3 in other IFDs are unrelated tags.
  diagnostic.refSource='通常タグ名';
  if ((diagnostic.latitudeTag||diagnostic.longitudeTag) && (tags?.GPSLatitudeRef===undefined||tags?.GPSLongitudeRef===undefined)) {
    try {
      const raw=await parser.parse(bytes,{tiff:true,ifd0:false,exif:false,gps:true,interop:false,ifd1:false,translateKeys:false,translateValues:false,reviveValues:false,mergeOutput:false});
      const gpsIfd=raw?.gps;
      const get=(name,id)=>gpsIfd?.[name]??gpsIfd?.[id]??gpsIfd?.['0x'+id.toString(16).padStart(4,'0')];
      const latRef=get('GPSLatitudeRef',1),lonRef=get('GPSLongitudeRef',3);
      if(latRef!==undefined&&tags.GPSLatitudeRef===undefined)tags.GPSLatitudeRef=latRef;
      if(lonRef!==undefined&&tags.GPSLongitudeRef===undefined)tags.GPSLongitudeRef=lonRef;
      diagnostic.refSource=Array.isArray(raw?.errors)&&raw.errors.length?'GPS IFD再解析エラー':gpsIfd?'GPS IFD数値タグ再確認（0x0001/0x0003）':'GPS IFDを取得できず・実タグ有無は未確定';
      if(gpsIfd&&(tags.GPSLatitudeRef===undefined||tags.GPSLongitudeRef===undefined))diagnostic.refSource+='・Ref未検出（方位は補完しません）';
    } catch {diagnostic.refSource='GPS IFD再解析失敗・実タグ有無は未確定';}
  }
  diagnostic.raw = `緯度値: ${describe(tags?.GPSLatitude)} / 南北: ${describe(tags?.GPSLatitudeRef)} / 経度値: ${describe(tags?.GPSLongitude)} / 東西: ${describe(tags?.GPSLongitudeRef)}`;
  const lat=coordinateDiagnostic(tags?.GPSLatitude,tags?.GPSLatitudeRef,'lat'),lon=coordinateDiagnostic(tags?.GPSLongitude,tags?.GPSLongitudeRef,'lon');
  diagnostic.conversion={latitude:lat.stage+' / '+lat.format+' / Ref '+lat.ref,longitude:lon.stage+' / '+lon.format+' / Ref '+lon.ref,fast:validGps(fast)?'成功':'取得不可'};
  const converted={latitude:lat.value,longitude:lon.value};
  const hasRaw=diagnostic.latitudeTag||diagnostic.longitudeTag;
  let gps = validGps(converted)?converted:null;
  // A library may omit a named Ref despite an intact GPS IFD. Recover only
  // from one unambiguous pair in the SAME original JPEG, never from guessed N/E.
  const segments=directRefs.segments.filter(s=>s.status==='GPS IFD確認済み');
  const direct=segments.map(s=>{
    const ref=id=>{const rs=s.refs.filter(r=>r.tag===id);return rs.length===1&&rs[0].type===2&&rs[0].count===2?({'4E 00':'N','53 00':'S','45 00':'E','57 00':'W'})[rs[0].hex]:undefined;};
    return {latitude:coordinate(s.dms?.find(r=>r.tag===2)?.values,ref(1),'lat'),longitude:coordinate(s.dms?.find(r=>r.tag===4)?.values,ref(3),'lon')};
  });
  const directValid=direct.length>0&&direct.every(p=>validGps(p)&&p.latitude===direct[0].latitude&&p.longitude===direct[0].longitude);
  // A simplified parser can return positive decimals with missing/empty Refs.
  // Actual invalid GPS IFD bytes must never be overridden by that shortcut.
  if(segments.length&&!directValid)gps=null;
  if(!gps&&directValid){gps=direct[0];diagnostic.refSource='元JPEGのGPS IFDからRef・度分秒を直接回収';}
  const conflicting=direct.some(p=>validGps(p))&&!directValid;
  if(conflicting){gps=null;diagnostic.error='複数EXIFのGPSが一致しません';}
  const refs=directRefs.segments.filter(s=>s.status==='GPS IFD確認済み').flatMap(s=>s.refs);
  const emptyDirection=[1,3].every(id=>refs.some(r=>r.tag===id))&&refs.every(r=>r.present&&r.emptyRef);
  const magnitude={latitude:coordinate(tags?.GPSLatitude,'N','lat'),longitude:coordinate(tags?.GPSLongitude,'E','lon')};
  if(emptyDirection&&!validGps(magnitude)){
    const pairs=directRefs.segments.filter(s=>s.status==='GPS IFD確認済み').map(s=>({latitude:coordinate(s.dms?.find(r=>r.tag===2)?.values,'N','lat'),longitude:coordinate(s.dms?.find(r=>r.tag===4)?.values,'E','lon')}));
    if(pairs.length&&pairs.every(p=>validGps(p)&&p.latitude===pairs[0].latitude&&p.longitude===pairs[0].longitude)){Object.assign(magnitude,pairs[0]);diagnostic.magnitudeSource='JPEG GPS IFDの有理数から直接変換';}
  }
  if(emptyDirection)diagnostic.magnitudeSource??=validGps(magnitude)?'EXIF解析値から絶対値変換':'数値変換失敗・JPEG直接診断の度分秒を確認';
  const missingRef = r=>r===undefined||r===null||directionOf(r)==='';
  const refsMissing=missingRef(tags?.GPSLatitudeRef)||missingRef(tags?.GPSLongitudeRef);
  const refsCompatible=[['lat',tags?.GPSLatitudeRef],['lon',tags?.GPSLongitudeRef]].every(([a,r])=>missingRef(r)||(a==='lat'?['N','S']:['E','W']).includes(directionOf(r)));
  if(!gps&&!conflicting&&(emptyDirection||(refsMissing&&refsCompatible&&validGps(magnitude))))diagnostic.directionPending={...magnitude,confirmed:false,numericValid:validGps(magnitude),latitudeRef:directionOf(tags?.GPSLatitudeRef),longitudeRef:directionOf(tags?.GPSLongitudeRef)};
  diagnostic.status = conflicting ? 'invalid' : gps ? 'ok' : diagnostic.directionPending?.numericValid ? 'direction_missing' : fullFailed ? 'error' : diagnostic.latitudeTag || diagnostic.longitudeTag || emptyDirection ? 'invalid' : 'missing';
  // Non-enumerable: device-only diagnostic, excluded from JSON/save metadata.
  Object.defineProperty(diagnostic,'directRefs',{value:directRefs});
  return { gps: gps ? {latitude: gps.latitude, longitude: gps.longitude} : null, diagnostic };
}
export function gpsStatus(row) {
  if (row.gps) return row.gpsDiagnostic?.status==='user_map'?'本人が地図で指定した撮影地点':row.gpsDiagnostic?.status==='user_confirmed'?'本人が方角を確認した撮影地点':'写真GPS取得成功';
  return ({direction_missing:'方角情報なし（撮影地点の確認が必要です）',error:'GPS情報の読み取りに失敗しました', invalid:'GPS座標が不正です', read_error:'写真を読み込めませんでした'})[row.gpsDiagnostic?.status] || '写真にGPS情報がありません';
}

export function confirmPhotoDirection(row,latRef,lonRef,verifiedMagnitude){
 const p=row.gpsDiagnostic?.directionPending;
 if(!p||p.confirmed||!['N','S'].includes(latRef)||!['E','W'].includes(lonRef))throw Error('方角を両方選択してください');
 if((p.latitudeRef&&p.latitudeRef!==latRef)||(p.longitudeRef&&p.longitudeRef!==lonRef))throw Error('EXIFに存在する方角と一致しません');
 const m=verifiedMagnitude??p;
 if(!validGps(m)||m.latitude<0||m.longitude<0)throw Error('撮影地点の数値を確認してください');
 const gps={latitude:m.latitude*(latRef==='S'?-1:1),longitude:m.longitude*(lonRef==='W'?-1:1)};
 if(!validGps(gps))throw Error('GPS座標が不正です');
 return {...row,gps,gpsDiagnostic:{...row.gpsDiagnostic,status:'user_confirmed',confirmedAt:new Date().toISOString(),directionPending:{...p,confirmed:true},positionSource:'本人が方角・撮影地点を確認',confirmedRefs:{latitude:latRef,longitude:lonRef}}};
}
