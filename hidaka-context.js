// Read-only adapter for get_hidaka_ai_context v1. Missing proposal data stays unknown.
const list=v=>Array.isArray(v)?v:[];
function frequency(orders,key){
 const counts=new Map();
 for(const order of orders){const seen=new Set();for(const item of list(order[key])){
  const id=item.menu_id||item.name;if(!id||seen.has(id))continue;seen.add(id);
  const row=counts.get(id)||{item_key:id,name:item.name,order_count:0};row.order_count++;counts.set(id,row);
 }}
 return [...counts.values()].sort((a,b)=>b.order_count-a.order_count||String(a.name).localeCompare(String(b.name)));
}
export function hidakaContext(data){
 const orders=list(data?.recent_orders).map(order=>{
  const items=list(order.items);
  return {...order,proposed_items:Array.isArray(order.proposed_items)?order.proposed_items:null,
   actual_items:items,removed_items:Array.isArray(order.removed_items)?order.removed_items:null,
   manual_items:Array.isArray(order.manual_items)?order.manual_items:items.filter(i=>i.source==='manual'),
   skewers:Array.isArray(order.skewers)?order.skewers:items.filter(i=>i.category==='skewer'),
   snacks:Array.isArray(order.snacks)?order.snacks:items.filter(i=>i.category==='small'),
   drinks:Array.isArray(order.drinks)?order.drinks:items.filter(i=>i.category==='drink'),
   satisfaction:order.feedback?.satisfaction??null,feedback:order.feedback??null};
 });
 const counts=orders.map(o=>o.skewer_count).filter(Number.isFinite);
 return {store:data?.store??null,recent_orders:orders,
  order_summary:{...data?.order_summary,
   frequent_actual_items:frequency(orders,'actual_items'),frequent_removed_items:frequency(orders,'removed_items'),
   frequent_manual_items:frequency(orders,'manual_items'),
   skewer_trend:{sample_count:counts.length,min:counts.length?Math.min(...counts):null,max:counts.length?Math.max(...counts):null,average:counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:null},
   high_satisfaction_orders:orders.filter(o=>o.satisfaction>=4),low_satisfaction_orders:orders.filter(o=>o.satisfaction>=1&&o.satisfaction<=2),
   sample_count:orders.length},
  shochu_status:data?.bottle_status??{has_keep:false,bottles:[],fixed_charge:null},
  history_source:data?.history_source??'legacy',menu_source:data?.data_source??null,
  generated_at:data?.generated_at??null,snapshot_at:data?.snapshot_at??null,limitations:list(data?.limitations)};
}

// Navigation Step1: evidence only. Never passed into scoring automatically.
export function ownerSafe(data,owner){
 if(!owner)return false;
 if(Array.isArray(data))return data.every(x=>ownerSafe(x,owner));
 if(data&&typeof data==='object')return Object.entries(data).every(([k,v])=>['user_id','owner_id'].includes(k)?v==null||v===owner:ownerSafe(v,owner));
 return true;
}
export function navigationContext(cloud,owner,at=new Date().toISOString()){
 if(!owner)throw Error('本人ログインが必要です。');
 const valid=key=>cloud[key]?.ok===true&&ownerSafe(cloud[key].data,owner);
 const rows=valid('shochu')&&Array.isArray(cloud.shochu.data)?cloud.shochu.data:[];
 const stores=new Map();
 for(const row of rows){if(!row.store_id||!row.bottle_id)continue;
  let store=stores.get(row.store_id);if(!store){store={store_id:row.store_id,name:row.store_name,area:row.area??null,latitude:row.latitude??null,longitude:row.longitude??null,closed_weekdays:row.closed_weekdays??[],is_basic_closed_today:row.is_basic_closed_today??null,last_visit_reference:row.last_visited_on??null,days_since_visit_reference:row.days_since_last_visit??null,visit_reference_note:'RPCの参照日。実訪問・ボトル最終訪問・キープ開始日のいずれかで、由来は未取得',bottles:[]};stores.set(row.store_id,store);}
  const value=Number.isFinite(row.remaining_percent)&&row.remaining_percent>=0&&row.remaining_percent<=100?row.remaining_percent:null;
  if(!store.bottles.some(b=>b.id===row.bottle_id))store.bottles.push({id:row.bottle_id,brand:row.brand??null,remaining_percent:value,remaining_observed_at:null,remaining_note:value===null?'残量不明':'保存済み残量。更新日時不明・現在量は要確認',kept_at:row.kept_at??null,status:row.status??null});
 }
 const h=valid('hidaka')?hidakaContext(cloud.hidaka.data):null;
 return {owner,read_at:at,foodContext:valid('food')?cloud.food.data:null,mealHistory:valid('history')?cloud.history.data:null,hidakaContext:h,shochuContext:valid('shochu')?{stores:[...stores.values()],scope:'active_remaining_only',remaining_update_history:null}:null,status:Object.fromEntries(['food','history','hidaka','shochu'].map(k=>[k,valid(k)?'available':'unavailable'])),limitations:['日高の注文実績は日高での実績。全店舗の好みへ一般化しない','定休日は通常の予定。現在営業は要確認','キープ参照結果にない店はキープなしと断定しない'],scoring_applied:false};
}
export function navigationReasons(context,candidate){
 if(!context?.owner||candidate?.user_id!==context.owner||!candidate.store_id)return [];
 const reasons=[],h=context.hidakaContext;
 if(h?.store?.id===candidate.store_id&&h.recent_orders.length)reasons.push({type:'orders',text:'日高での過去の注文実績あり',count:h.recent_orders.length});
 const s=context.shochuContext?.stores.find(s=>s.store_id===candidate.store_id);
 if(s){if(s.bottles.some(b=>b.status==='active'&&b.remaining_percent>0))reasons.push({type:'keep',text:'キープボトルあり（保存情報・現在残量は要確認）'});
 if(s.bottles.some(b=>b.remaining_percent!==null))reasons.push({type:'remaining',text:'焼酎残量の保存情報あり（更新日時不明）'});
 if(s.last_visit_reference)reasons.push({type:'visit_reference',text:'訪問等の参照日あり（キープ開始日による補完の可能性）',date:s.last_visit_reference});
 if(s.is_basic_closed_today===true)reasons.push({type:'closed',text:'通常は定休日・営業要確認'});
 }return reasons;
}

// Only the authenticated RPC-derived candidate may open the configured order app.
export function hidakaOrderUrl(candidate, context, owner, url, status) {
 if (!owner || owner === 'guest' || context?.owner !== owner || !['selected','going'].includes(status)) return null;
 const id=context.hidakaContext?.store?.id;
 if (!id || candidate?.id !== 'hidaka' || candidate.app !== 'hidaka' || candidate.discovered || candidate.store_id !== id || candidate.hidaka_context?.store?.id !== id) return null;
 if (candidate.user_id && candidate.user_id !== owner) return null;
 try { const parsed=new URL(url); return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:null; } catch { return null; }
}
