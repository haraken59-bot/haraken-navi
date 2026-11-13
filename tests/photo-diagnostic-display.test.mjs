import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectGps,diagnosticDisplayExtras} from '../importer/gps-diagnostics.js';
import {prepare,createRow} from '../importer/photos.js';
import {refDiagnosticText} from '../importer/jpeg-ref-diagnostics.js';
import {gpsJpeg} from './gps-fixture.mjs';

const file=bytes=>new File([bytes],'synthetic.jpg',{type:'image/jpeg'});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function prepared(bytes){
  const f=file(bytes);
  const oldBitmap=globalThis.createImageBitmap,oldDoc=globalThis.document;
  globalThis.createImageBitmap=async()=>({width:100,height:100,close(){}});
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:cb=>cb(new Blob(['no EXIF'],{type:'image/jpeg'}))})};
  try{return await prepare(f,createRow(f));}
  finally{globalThis.createImageBitmap=oldBitmap;globalThis.document=oldDoc;}
}
// Pattern alpha: GPS rational values zeroed (0/0), Refs intact.
// Fixture layout: TIFF starts at byte 12; rational arrays at TIFF 80 and 104.
function patternAlpha(){const b=gpsJpeg();b.fill(0,92,116);b.fill(0,116,140);return b;}
// Pattern beta: alpha plus both Ref values emptied (first Ref bytes at 48 and 72).
function patternBeta(){const b=patternAlpha();b[48]=0;b[72]=0;return b;}

test('valid JPEG: received-bytes SHA-256 is computed and displayed in full',async()=>{
  const bytes=gpsJpeg();
  const row=await prepared(bytes);
  assert.equal(row.fingerprint,sha256(bytes));
  assert.equal(row.gpsDiagnostic.status,'ok');
  assert.deepEqual(row.gps,{latitude:35.5,longitude:135.25});
  const extras=diagnosticDisplayExtras(row.gpsDiagnostic,row.fingerprint);
  assert.equal(extras.sha256,row.fingerprint);
  assert.equal(extras.sha256.length,64);
});

test('pattern alpha (values invalidated): SHA-256 still displayed, status stays invalid',async()=>{
  const bytes=patternAlpha();
  const row=await prepared(bytes);
  assert.equal(row.gps,null);
  assert.equal(row.gpsDiagnostic.status,'invalid');
  const extras=diagnosticDisplayExtras(row.gpsDiagnostic,row.fingerprint);
  assert.equal(extras.sha256,sha256(bytes));
});

test('pattern beta (Refs emptied + values invalidated): SHA-256 displayed, direction_missing kept',async()=>{
  const bytes=patternBeta();
  const row=await prepared(bytes);
  assert.equal(row.gps,null);
  assert.equal(row.gpsDiagnostic.status,'direction_missing');
  assert.equal(row.gpsDiagnostic.directionPending.numericValid,false);
  const extras=diagnosticDisplayExtras(row.gpsDiagnostic,row.fingerprint);
  assert.equal(extras.sha256,sha256(bytes));
  assert.match(extras.directScan,/EXIFのRef値が空です/);
});

test('direct scan summary is the existing refDiagnosticText of the same diagnostic',async()=>{
  const row=await prepared(gpsJpeg());
  const extras=diagnosticDisplayExtras(row.gpsDiagnostic,row.fingerprint);
  assert.equal(extras.directScan,refDiagnosticText(row.gpsDiagnostic.directRefs));
  assert.match(extras.directScan,/GPS@/);
  assert.match(extras.directScan,/0x0001/);
});

test('missing diagnostic or fingerprint shows not-obtained states',()=>{
  assert.deepEqual(diagnosticDisplayExtras(undefined,undefined),{sha256:'未取得',directScan:'未実施'});
  assert.deepEqual(diagnosticDisplayExtras(null,''),{sha256:'未取得',directScan:'未実施'});
  assert.equal(diagnosticDisplayExtras({},'not-a-hash').sha256,'未取得');
  const ok=diagnosticDisplayExtras({directRefs:null},'a'.repeat(64));
  assert.equal(ok.sha256,'a'.repeat(64));
  assert.equal(ok.directScan,'未実施');
});

test('GPS determination is unchanged: prepare matches inspectGps on the same bytes',async()=>{
  for(const bytes of [gpsJpeg(),patternAlpha(),patternBeta()]){
    const row=await prepared(bytes);
    const direct=await inspectGps(file(bytes),undefined,bytes.slice().buffer);
    assert.equal(row.gpsDiagnostic.status,direct.diagnostic.status);
    assert.deepEqual(row.gps,direct.gps);
  }
});

test('meal-ui renders the extras inside the details block with wrap-safe styling',()=>{
  const src=readFileSync(new URL('../meal-ui.js',import.meta.url),'utf8');
  assert.ok(src.includes('SHA-256（受け取ったファイル）'));
  assert.ok(src.includes('GPS直接走査'));
  assert.ok(src.includes('overflow-wrap:anywhere'));
  const detailsAt=src.indexOf('<details><summary>詳細診断');
  const extrasAt=src.indexOf('${diagnosticExtrasHtml(p)}');
  assert.ok(detailsAt>-1&&extrasAt>detailsAt);
});
