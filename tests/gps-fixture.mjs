// Synthetic EXIF only, no personal photo data.
export function gpsJpeg(little=true,latRef='N',lonRef='E'){
 const t=new Uint8Array(128),v=new DataView(t.buffer);t.set(little?[73,73]:[77,77]);
 const u16=(o,n)=>v.setUint16(o,n,little),u32=(o,n)=>v.setUint32(o,n,little);
 u16(2,42);u32(4,8);u16(8,1);u16(10,0x8825);u16(12,4);u32(14,1);u32(18,26);u32(22,0);
 u16(26,4);const ent=(o,tag,type,count,value)=>{u16(o,tag);u16(o+2,type);u32(o+4,count);u32(o+8,value);};
 ent(28,1,2,2,0);t[36]=latRef.charCodeAt();ent(40,2,5,3,80);ent(52,3,2,2,0);t[60]=lonRef.charCodeAt();ent(64,4,5,3,104);
 for(const [off,nums]of [[80,[35,30,0]],[104,[135,15,0]]])nums.forEach((n,i)=>{u32(off+i*8,n);u32(off+i*8+4,1);});
 const jpeg=new Uint8Array(142);jpeg.set([255,216,255,225,0,136,69,120,105,102,0,0]);jpeg.set(t,12);jpeg.set([255,217],140);return jpeg;
}
