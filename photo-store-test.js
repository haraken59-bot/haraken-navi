import {loadPublicConfig} from './api.js';
import {MealClient} from './meal-client.js';
const form=document.querySelector('#test-search'),status=document.querySelector('#status'),output=document.querySelector('#results');
form.addEventListener('submit',async event=>{
 event.preventDefault();output.textContent='';status.textContent='検証用Edgeへ問い合わせ中…';
 const data=new FormData(form),latitude=Number(data.get('latitude')),longitude=Number(data.get('longitude')),hint=String(data.get('name')||'').trim();
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!hint){status.textContent='入力値を確認してください。';return;}
 const button=form.querySelector('button');button.disabled=true;
 try{
  const config=await loadPublicConfig(location.href),client=new MealClient(config,localStorage);
  await client.verifyNaviOwner();
  const session=await client.fresh();
  const url=new URL(config.url+'/functions/v1/navi-discover-photo-test');
  for(const [key,value] of Object.entries({mode:'discover',latitude,longitude,direction:'near',hint,photoStoreLookup:'1'}))url.searchParams.set(key,String(value));
  const response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('検証用Edge HTTP '+response.status);
  const result=await response.json();
  if(client.session()?.user?.id!==session.user.id)throw Error('ログイン状態が変わりました');
  const rows=(Array.isArray(result.candidates)?result.candidates:[]).filter(c=>c&&typeof c.name==='string').map(c=>({name:c.name,address:c.address||c.hotpepper?.address||'',latitude:c.latitude,longitude:c.longitude}));
  status.textContent='検証用Edge応答。候補 '+rows.length+' 件（店舗登録・保存なし）';
  output.textContent=JSON.stringify({radius_m:result.radius_m,search_radii:result.search_radii,search_terms:result.search_terms,partial:result.partial,candidates:rows},null,2);
 }catch(error){status.textContent='検索できませんでした：'+error.message+'。通常画面で本人ログイン済みか確認してください。';}
 finally{button.disabled=false;}
});
