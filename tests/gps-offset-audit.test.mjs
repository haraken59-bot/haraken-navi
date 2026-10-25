import test from 'node:test';
import assert from 'node:assert/strict';
import exifr from '../vendor/exifr.mjs';
import {inspectJpegRefs} from '../importer/jpeg-ref-diagnostics.js';
import {inspectGps} from '../importer/gps-diagnostics.js';

// Independently laid out TIFF: displaced IFD0/GPS/data, unrelated APP0/APP1 first.
function fixture(le){
 const t=new Uint8Array(360),v=new DataView(t.buffer);
 const s=(o,n)=>v.setUint16(o,n,le),l=(o,n)=>v.setUint32(o,n,le);
 t.set(le?[73,73]:[77,77]);s(2,42);l(4,32);
 s(32,1);s(34,0x8825);s(36,4);l(38,1);l(42,96);
 s(96,4);
 const entry=(o,id,type,count,data)=>{s(o,id);s(o+2,type);l(o+4,count);l(o+8,data);};
 entry(98,1,2,2,0);t.set([78,0],106);
 entry(110,2,5,3,240);
 entry(122,3,2,2,0);t.set([69,0],130);
 entry(134,4,5,3,304);
 for(const [offset,parts] of [[240,[[33,1],[34,1],[4301,100]]],[304,[[130,1],[20,1],[5979,100]]]])parts.forEach(([n,d],i)=>{l(offset+i*8,n);l(offset+i*8+4,d);});
 const segment=(marker,payload)=>new Uint8Array([255,marker,(payload.length+2)>>8,(payload.length+2)&255,...payload]);
 return new Uint8Array([255,216,...segment(224,[74,70,73,70,0,0]),...segment(225,[88,77,80,0,0,0]),...segment(225,[69,120,105,102,0,0,...t]),255,217]);
}
for(const le of [true,false])test('displaced TIFF same-buffer direct/library/automatic GPS '+(le?'II':'MM'),async()=>{
 const bytes=fixture(le),before=bytes.slice(),buffer=bytes.buffer;
 const d=inspectJpegRefs(buffer),seg=d.segments[0];
 assert.equal(seg.app1Offset,22);assert.equal(seg.tiffOffset,32);assert.equal(seg.gpsIfdOffset,128);
 assert.deepEqual(seg.refs.map(r=>r.hex),['4E 00','45 00']);
 assert.deepEqual(seg.dms.map(r=>r.values),[[33,34,43.01],[130,20,59.79]]);
 const lib=await exifr.gps(buffer),result=await inspectGps(new File([bytes],'synthetic.jpg'),undefined,buffer);
 const expected={latitude:33+34/60+43.01/3600,longitude:130+20/60+59.79/3600};
 for(const key of ['latitude','longitude']){assert.ok(Math.abs(lib[key]-expected[key])<1e-9);assert.ok(Math.abs(result.gps[key]-expected[key])<1e-9);}
 assert.equal(result.diagnostic.status,'ok');assert.deepEqual(bytes,before);
 assert.deepEqual(inspectJpegRefs(buffer),d);
});
