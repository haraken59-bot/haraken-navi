import {PROJECT} from './api.js';

export function mountPhotoIdCheck({client,isMember,container=document.getElementById('settings')}){
 if(new URLSearchParams(location.search).get('photo_id_test')!=='1'||!container)return;
 const section=document.createElement('section');
 const title=document.createElement('h3');
 title.textContent='店舗ID照合テスト（万徳）';
 const button=document.createElement('button');
 button.type='button';
 button.textContent='Hot Pepper店舗IDを照合';
 const result=document.createElement('pre');
 result.setAttribute('aria-live','polite');
 const compareButton=document.createElement('button');
 compareButton.type='button';
 compareButton.textContent='店名3方式を比較';
 section.append(title,button,compareButton,result);
 compareButton.addEventListener('click',async()=>{
  if(!isMember()){result.textContent='本人ログインが必要です';return;}
  compareButton.disabled=true;
  result.textContent='店名検索を比較中…';
  try{
   const session=await client.fresh();
   const url=new URL(PROJECT+'/functions/v1/navi-discover-photo-test');
   url.searchParams.set('mode','photo-name-compare');
   const response=await fetch(url,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(35000)});
   if(!response.ok)throw Error('比較に失敗しました（HTTP '+response.status+'）');
   const data=await response.json();
   result.textContent=JSON.stringify(data,null,2);
  }catch(error){result.textContent=error.message||'比較に失敗しました';}
  finally{compareButton.disabled=false;}
 });
 container.append(section);
 button.addEventListener('click',async()=>{
  if(!isMember()){result.textContent='本人ログインが必要です';return;}
  button.disabled=true;
  result.textContent='照合中…';
  try{
   const session=await client.fresh();
   const url=new URL(PROJECT+'/functions/v1/navi-discover-photo-test');
   url.search=new URLSearchParams({mode:'photo-id-check',id:'J000113208',latitude:'32.742920',longitude:'129.875415'});
   const response=await fetch(url,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('照合に失敗しました（HTTP '+response.status+'）');
   const data=await response.json();
   if(data.id!=='J000113208')throw Error('想定外の応答');
   result.textContent=JSON.stringify({found:data.found===true,id:data.id,name:data.name||'',address:data.address||'',distance_m:data.distance_m,within_3km:data.within_3km},null,2);
  }catch(error){result.textContent=error.message||'照合に失敗しました';}
  finally{button.disabled=false;}
 });
}
