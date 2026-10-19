// Synthetic preview only: no database, owner data, API key or external provider.
// This endpoint validates GPS-distance inclusion and visit badge presentation.
// It is NOT a replacement for a database integration test.
const ORIGIN='https://haraken59-bot.github.io';
const meters=(a,b)=>{const r=Math.PI/180,dLat=(b.latitude-a.latitude)*r,dLon=(b.longitude-a.longitude)*r;const q=Math.sin(dLat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));};
const rows=[
 {id:'fixture:unvisited',name:'検証用・未訪問店',north:0,east:0,used:false,revisited:false},
 {id:'fixture:used',name:'検証用・訪問1回店',north:0.001,east:0,used:true,revisited:false},
 {id:'fixture:revisited',name:'検証用・訪問2回店',north:0,east:0.001,used:true,revisited:true},
 {id:'fixture:outside',name:'検証用・範囲外店',north:0.02,east:0,used:false,revisited:false},
];
export function syntheticPreview(req){
 const origin=req.headers.get('origin');
 const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff',...(origin===ORIGIN?{'Access-Control-Allow-Origin':ORIGIN}:{})};
 const reply=(status,data)=>Response.json(data,{status,headers});
 if(origin&&origin!==ORIGIN)return reply(403,{ok:false,error:'origin_not_allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
 if(req.method!=='GET')return reply(405,{ok:false,error:'method_not_allowed'});
 const params=new URL(req.url).searchParams;
 const latitude=Number(params.get('latitude')),longitude=Number(params.get('longitude')),radius=Number(params.get('radius_m')||500);
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(radius)||radius<1||radius>3000||!params.has('latitude')||!params.has('longitude'))return reply(400,{ok:false,error:'invalid_coordinates'});
 const center={latitude,longitude};
 const candidates=rows.map(row=>({id:row.id,store_id:row.id,name:row.name,latitude:latitude+row.north,longitude:longitude+row.east,source_kind:'synthetic_fixture',source:'検証用の架空店舗',haraken_usage:row.revisited?'revisited':row.used?'used':'unvisited',fixture_only:true})).filter(x=>meters(center,x)<=radius).sort((a,b)=>meters(center,a)-meters(center,b));
 return reply(200,{ok:true,fixture_only:true,center,radius_m:radius,candidates,warning:'架空店舗の表示確認専用です。実DB検索・店舗発見の検証結果ではありません。'});
}
