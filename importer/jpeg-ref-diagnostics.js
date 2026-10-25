// Bounded device-only JPEG GPS diagnostic. No network or persistence.
export function inspectJpegRefs(buffer){
 const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),result={status:'JPEG未対応',segments:[]};
 if(b.length<2||b[0]!==255||b[1]!==216)return result;
 result.status='EXIFなし';let p=2;
 try{
  for(let steps=0;p<b.length&&steps<4096;steps++){
   if(b[p++]!==255)throw Error();while(b[p]===255)p++;const marker=b[p++];
   if(marker===218||marker===217)break;if(marker===1||(marker>=208&&marker<=215))continue;
   if(p+2>b.length)throw Error();const len=v.getUint16(p),end=p+len;if(len<2||end>b.length)throw Error();
   if(marker===225&&len>=8&&[69,120,105,102,0,0].every((n,i)=>b[p+2+i]===n)){
    if(result.segments.length>=8)throw Error();const start=p+8,seg={app1Offset:p-2,tiffOffset:start,status:'解析中',refs:[]};result.segments.push(seg);
    try{
     const bounds=(o,n)=>{if(!Number.isInteger(o)||o<start||o+n>end)throw Error();};bounds(start,8);
     const le=b[start]===73&&b[start+1]===73;if(!le&&!(b[start]===77&&b[start+1]===77))throw Error();seg.endian=le?'II':'MM';
     const u16=o=>{bounds(o,2);return v.getUint16(o,le);},u32=o=>{bounds(o,4);return v.getUint32(o,le);};if(u16(start+2)!==42)throw Error();
     const entries=off=>{const n=u16(off);if(n>1024)throw Error();bounds(off+2,n*12+4);return Array.from({length:n},(_,i)=>off+2+i*12);};
     const roots=entries(start+u32(start+4)).filter(o=>u16(o)===0x8825);if(!roots.length){seg.status='GPS IFDなし';p=end;continue;}if(roots.length!==1)throw Error();
     const root=roots[0];if(u16(root+2)!==4||u32(root+4)!==1)throw Error();const gps=start+u32(root+8);seg.gpsIfdOffset=gps;
     const es=entries(gps);for(const id of [1,3]){
      const found=es.filter(o=>u16(o)===id);if(!found.length){seg.refs.push({tag:id,present:false});continue;}
      for(const o of found){const type=u16(o+2),count=u32(o+4),sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8},size=sizes[type];const r={tag:id,present:true,type,count,entryOffset:o};seg.refs.push(r);
       if(!size||count>32){r.status='非対応型・長さ';continue;}const length=count*size,data=length<=4?o+8:start+u32(o+8);bounds(data,length);r.storage=length<=4?'inline':'offset';r.valueOffset=data;
       // Only tiny direction bytes; never expose other tags/coordinates.
       if((type===2||type===1||type===7)&&count<=8){const bytes=Array.from(b.slice(data,data+length));r.hex=bytes.slice(0,2).map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join(' ');r.emptyRef=type===2&&count===2&&bytes.every(n=>n===0);r.value=bytes.map(n=>n===0?'\\0':n>=32&&n<127?String.fromCharCode(n):'\\x'+n.toString(16).padStart(2,'0')).join('');r.status='読取成功';}else r.status='Ref型を要確認';
      }
     }
     seg.dms=[];
     for(const id of [2,4]){
      const found=es.filter(o=>u16(o)===id),r={tag:id,status:'タグ欠落・重複'};seg.dms.push(r);if(found.length!==1)continue;
      const o=found[0];r.type=u16(o+2);r.count=u32(o+4);if(r.type!==5||r.count!==3){r.status='RATIONAL型5・3要素ではありません';continue;}
      try{const data=start+u32(o+8);bounds(data,24);r.parts=Array.from({length:3},(_,i)=>({numerator:u32(data+i*8),denominator:u32(data+i*8+4)}));const bad=r.parts.findIndex(p=>p.denominator===0);r.status=bad<0?'有理数読取成功':['度','分','秒'][bad]+'の分母が0';if(bad<0)r.values=r.parts.map(p=>p.numerator/p.denominator);}catch{r.status='数値領域の範囲エラー';}
     }
     seg.status='GPS IFD確認済み';
    }catch{seg.status='構造・範囲エラー（有無未確定）';}
   }p=end;
  }
  result.status=result.segments.length?'EXIF直接診断完了':'EXIFなし';
 }catch{result.status='JPEG構造・上限エラー（有無未確定）';}
 return result;
}
export function refDiagnosticText(d){if(!d)return '未実施';return d.status+' / '+d.segments.map(s=>'APP1@'+s.app1Offset+' TIFF@'+s.tiffOffset+' '+(s.endian||'')+' GPS@'+(s.gpsIfdOffset??'?')+' '+s.status+' / '+(s.dms||[]).map(r=>'数値タグ0x'+r.tag.toString(16).padStart(4,'0')+' 型='+r.type+' '+r.status+' '+JSON.stringify(r.parts||[])).join(' / ')+' / '+s.refs.map(r=>'0x'+r.tag.toString(16).padStart(4,'0')+': '+(r.present?'型='+r.type+' 個数='+r.count+' '+(r.storage||'')+' entry@'+r.entryOffset+' value@'+(r.valueOffset??'?')+' 生バイト先頭2(hex)='+ (r.hex??'未読取')+' 文字列表現='+JSON.stringify(r.value??'未読取')+(r.emptyRef?' EXIFのRef値が空です（方位は補完しません）':'')+' '+r.status:'タグなし')).join(' / ')).join(' | ');}
