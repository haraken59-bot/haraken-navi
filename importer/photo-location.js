// Shared with meal-importer/src/photo-location.js. No network or persistence here.
export const LOCATION_HELP='この写真から撮影地点を取得できませんでした。地図で撮影地点を指定できます。指定しなくても写真を保存できます。';
export function validPoint(p){return !!p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
export function photoLocation(row){
 if(!validPoint(row.gps))return null;
 const source=row.gpsDiagnostic?.positionSource;
 return {latitude:row.gps.latitude,longitude:row.gps.longitude,source:source==='user_map'?'user_map':row.gpsDiagnostic?.status==='user_confirmed'?'user_direction':'exif',confirmed_at:row.gpsDiagnostic?.confirmedAt||null};
}
export function confirmMapPoint(row,point,at=new Date().toISOString()){
 if(validPoint(row.gps)&&row.gpsDiagnostic?.status!=='user_map')throw Error('取得済みの撮影位置は上書きしません');
 if(!validPoint(point))throw Error('撮影地点が不正です');
 return {...row,gps:{latitude:point.latitude,longitude:point.longitude},gpsDiagnostic:{...row.gpsDiagnostic,originalStatus:row.gpsDiagnostic?.originalStatus||row.gpsDiagnostic?.status||'missing',status:'user_map',positionSource:'user_map',confirmedAt:at}};
}
export function project(p,z){const size=256*2**z,lat=Math.max(-85.05112878,Math.min(85.05112878,p.latitude))*Math.PI/180;return {x:(p.longitude+180)/360*size,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*size};}
export function unproject(x,y,z){const size=256*2**z;return {latitude:Math.atan(Math.sinh(Math.PI*(1-2*Math.max(0,Math.min(size,y))/size)))*180/Math.PI,longitude:((x/size*360)%360+360)%360-180};}
