import test from 'node:test';import assert from 'node:assert/strict';
import {coordinate,inspectGps,gpsStatus} from '../importer/gps-diagnostics.js';
import {prepare,createRow} from '../importer/photos.js';import {gpsJpeg} from './gps-fixture.mjs';
const file=bytes=>new File([bytes],'synthetic.jpg',{type:'image/jpeg'});
for(const little of [true,false])test('real parser synthetic EXIF byte order '+little,async()=>{const r=await inspectGps(file(gpsJpeg(little)));assert.deepEqual(r.gps,{latitude:35.5,longitude:135.25});assert.equal(r.diagnostic.status,'ok');});
test('south and west actual EXIF',async()=>assert.deepEqual((await inspectGps(file(gpsJpeg(true,'S','W')))).gps,{latitude:-35.5,longitude:-135.25}));
test('DMS decimals signs and invalid ranges',()=>{assert.equal(coordinate([35,30,0],'S','lat'),-35.5);assert.equal(coordinate(135.25,'W','lon'),-135.25);for(const [v,r,a]of [[[91,0,0],'N','lat'],[[1,60,0],'N','lat'],[181,'E','lon'],[NaN,'N','lat'],[35,'W','lat']])assert.equal(coordinate(v,r,a),null);});
test('GPS absent separate from parse error and invalid tag',async()=>{const f=file([]);const stub=t=>({gps:async()=>null,parse:async()=>t});assert.equal((await inspectGps(f,stub(undefined))).diagnostic.status,'missing');assert.equal((await inspectGps(f,{gps:async()=>null,parse:async()=>{throw Error();}})).diagnostic.status,'error');assert.equal((await inspectGps(f,stub({GPSLatitude:999,GPSLatitudeRef:'N'}))).diagnostic.status,'invalid');});
test('file read error never invokes parser',async()=>{const r=await inspectGps({arrayBuffer:async()=>{throw Error();}},{gps:()=>{throw Error('should not run');}});assert.equal(r.diagnostic.status,'read_error');assert.equal(gpsStatus({gpsDiagnostic:r.diagnostic}),'写真を読み込めませんでした');});
test('original bytes GPS held before conversion',async()=>{const f=file(gpsJpeg());let called=0;const oldBitmap=globalThis.createImageBitmap,oldDoc=globalThis.document;globalThis.createImageBitmap=async()=>{called++;return {width:100,height:100,close(){}}};globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:cb=>cb(new Blob(['no EXIF'],{type:'image/jpeg'}))})};try{const row=await prepare(f,createRow(f));assert.equal(called,1);assert.deepEqual(row.gps,{latitude:35.5,longitude:135.25});assert.equal(await row.blob.text(),'no EXIF');URL.revokeObjectURL(row.url);}finally{globalThis.createImageBitmap=oldBitmap;globalThis.document=oldDoc;}});
test('all five diagnostic labels',()=>{for(const [state,label]of [['missing','写真にGPS情報がありません'],['error','GPS情報の読み取りに失敗しました'],['invalid','GPS座標が不正です'],['read_error','写真を読み込めませんでした']])assert.equal(gpsStatus({gpsDiagnostic:{status:state}}),label);assert.equal(gpsStatus({gps:{latitude:35,longitude:135}}),'写真GPS取得成功');});

test('parser soft errors are not GPS missing',async()=>{const r=await inspectGps(file([]),{gps:async()=>null,parse:async()=>({errors:[Error('fixture')]})});assert.equal(r.diagnostic.status,'error');});

test('rational DMS object and pair formats, byte refs',async()=>{
 for(const value of [[[35,1],[30,1],[0,1]],[{numerator:35,denominator:1},{numerator:30,denominator:1},{numerator:0,denominator:1}],new Float64Array([35,30,0])])assert.equal(coordinate(value,new Uint8Array([83,0]),'lat'),-35.5);
 assert.equal(coordinate({numerator:71,denominator:2},'N','lat'),35.5);assert.equal(coordinate(0,'N','lat'),0);
 const r=await inspectGps(file([]),{gps:async()=>null,parse:async()=>({GPSLatitude:[[35,1],[30,1],[0,1]],GPSLatitudeRef:'N',GPSLongitude:[[135,1],[15,1],[0,1]],GPSLongitudeRef:'E'})});assert.deepEqual(r.gps,{latitude:35.5,longitude:135.25});
});
test('bad rational denominator and missing Ref stay invalid with stage',async()=>{
 for(const d of [0,NaN,-1])assert.equal(coordinate([[35,1],[30,1],[0,d]],'N','lat'),null);
 const r=await inspectGps(file([]),{gps:async()=>null,parse:async()=>({GPSLatitude:[35,30,0],GPSLongitude:[135,15,0],GPSLongitudeRef:'E'})});assert.equal(r.diagnostic.status,'invalid');assert.match(r.diagnostic.conversion.latitude,/Ref未検出/);
});

test('missing named Refs recovered only from GPS numeric IFD',async()=>{const parser={gps:async()=>null,parse:async(b,o)=>o.mergeOutput===false?{gps:{1:'S',3:'W'}}:{GPSLatitude:[35,30,0],GPSLongitude:[135,15,0]}};const r=await inspectGps(file([]),parser);assert.deepEqual(r.gps,{latitude:-35.5,longitude:-135.25});assert.match(r.diagnostic.refSource,/数値タグ/);});
test('hex keys, named keys and Ref representations',async()=>{for(const refs of [{'0x0001':['N'],'0x0003':new Uint8Array([69,0])},{GPSLatitudeRef:78,GPSLongitudeRef:'E\0'}]){const r=await inspectGps(file([]),{gps:async()=>null,parse:async(b,o)=>o.mergeOutput===false?{gps:refs}:{GPSLatitude:[35,30,0],GPSLongitude:[135,15,0]}});assert.deepEqual(r.gps,{latitude:35.5,longitude:135.25});}});
test('missing or unrelated IFD refs never infer N/E',async()=>{for(const raw of [{gps:{2:[35,30,0],4:[135,15,0]}},{ifd0:{1:'N',3:'E'}}]){const r=await inspectGps(file([]),{gps:async()=>({latitude:35.5,longitude:135.25}),parse:async(b,o)=>o.mergeOutput===false?raw:{GPSLatitude:[35,30,0],GPSLongitude:[135,15,0]}});assert.equal(r.gps,null);assert.equal(r.diagnostic.status,'invalid');}});
test('real library numeric GPS IFD returns tags 1 and 3',async()=>{const {default:parser}=await import('../vendor/exifr.mjs');const r=await parser.parse(gpsJpeg().buffer,{tiff:true,ifd0:false,exif:false,gps:true,interop:false,ifd1:false,translateKeys:false,translateValues:false,reviveValues:false,mergeOutput:false});assert.equal(r.gps[1],'N');assert.equal(r.gps[3],'E');});
