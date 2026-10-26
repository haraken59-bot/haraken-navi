// Reconcile an uncertain update before any new write. Never register or delete here.
export async function linkSavedMeal({client,row,store,isCurrent=()=>true}){
 const owner=client.session()?.user?.id;
 const check=()=>{if(!owner||!isCurrent()||client.session()?.user?.id!==owner)throw Error('ログイン状態が変わりました。');};
 const read=async()=>{
  for(let offset=0;offset<1000;offset+=100){
   check();const page=await client.historyPage(offset);check();
   const found=page.find(r=>r.id===row.id);if(found)return found;
   if(page.length<100)break;
  }
  throw Error('対象履歴を確認できません。履歴を再取得してください。');
 };
 check();const current=await read();
 if(current.store_id===store.id)return current;
 if(current.revision!==row.revision||current.store_id)throw Error('履歴が更新されています。再取得して店舗を確認してください。');
 try{await client.editMeal(current,{store_id:store.id,unlinked_store_name:null});check();}
 catch(error){check();const after=await read();if(after.store_id===store.id)return after;throw error;}
 return {...current,store_id:store.id,unlinked_store_name:null};
}
