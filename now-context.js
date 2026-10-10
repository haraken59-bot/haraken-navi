// Orchestration only: ranking and discovery remain in their existing modules.
export function localAction(ctx){return ctx.direction==='wait'||/家で|自宅で|まだ決めない|後で決め|食べない|飲まない/.test(ctx.desire||'');}
export function validLocation(p){return Number.isFinite(p?.latitude)&&Number.isFinite(p?.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
export function locateCurrent(geo=globalThis.navigator?.geolocation){
 return new Promise((resolve,reject)=>{if(!geo){reject(Error('位置情報なし'));return;}geo.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{timeout:10000,maximumAge:300000});});
}
export async function prepareNow(input,{locate=locateCurrent,now=new Date(),preferGps=false}={}){
 const context={...input,entrypoint:'now',requested_at:now.toISOString(),weekday:new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',weekday:'long'}).format(now)};
 if(!validLocation(context.location))context.location=null;
 if(!localAction(context)&&(preferGps||!context.area?.trim())&&!context.location){try{const p=await locate();if(validLocation(p))context.location=p;}catch{/* Manual area is the existing fallback. */}}
 return {context,needsLocation:!localAction(context)&&!context.area?.trim()&&!context.location};
}
export const HISTORY_TTL=5*60*1000;
export function historyReusable(savedOwner,owner,fetchedAt,now=Date.now()){return owner!=='guest'&&savedOwner===owner&&fetchedAt>0&&now>=fetchedAt&&now-fetchedAt<HISTORY_TTL;}
