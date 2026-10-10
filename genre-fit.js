import {outsidePublishedHours} from './places.js';
const rules={魚:/魚|寿司|すし|鮨|海鮮|刺身|焼き?魚|煮魚|魚介|鮮魚|seafood|sushi/i,肉:/肉|焼鳥|焼き鳥|やきとり|ステーキ|とんかつ|ハンバーグ|唐揚げ|焼肉|yakitori|steak|barbecue/i,麺:/麺|ラーメン|らーめん|うどん|そば|ちゃんぽん|パスタ|焼きそば|ramen|noodle|udon|soba|pasta/i,中華:/中華|中国料理|餃子|麻婆豆腐|炒飯|チャーハン|やきめし|四川|広東|台湾料理|chinese/i,定食:/定食|セット食|teishoku/i};
const dishes={...rules,魚:/寿司|すし|鮨|海鮮|刺身|焼き?魚|煮魚|魚介|鮮魚|魚料理|seafood|sushi/i,肉:/肉料理|焼肉|焼鳥|焼き鳥|やきとり|ステーキ|とんかつ|ハンバーグ|唐揚げ|yakitori|steak|barbecue/i,麺:/麺料理|ラーメン|らーめん|うどん|そば|ちゃんぽん|パスタ|焼きそば|ramen|noodle|udon|soba|pasta/i};
const sweets=/たい焼|たいやき|鯛焼|鯛魚[焼燒]|和菓子|洋菓子|スイーツ|デザート|菓子|ドーナツ|ケーキ|アイスクリーム|confectionery|dessert|ice_cream/i;
const clean=s=>String(s||'').normalize('NFKC').replace(/たい焼き?|たいやき|鯛焼き?|鯛魚[焼燒]/g,'菓子').replace(/(?:魚|肉|麺|中華|定食)(?:料理)?(?:は|の提供は)?(?:なし|無し|提供していません)/g,'');
export function requestedGenre(ctx){const q=ctx.desire?.trim()|| (ctx.category==='おまかせ'?'':ctx.category)||'';if(/家で|自宅で|食べない|飲まない|まだ決めない|後で決め/.test(q))return null;return Object.keys(rules).find(k=>rules[k].test(clean(q)))||null;}
const hour=d=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(d));
function lunchTime(c,text,now){
 const ranges=[...String(text+' '+(c.hours||'')).normalize('NFKC').matchAll(/(\d{1,2}):(\d{2})\s*[～〜~-]\s*(\d{1,2}):(\d{2})/g)].filter(m=>Number(m[1])>=6&&Number(m[3])<=16&&Number(m[3])>Number(m[1]));
 if(!ranges.length)return null;
 return !outsidePublishedHours({hours:ranges.map(m=>m[0]).join(' ')},now);
}
export function genreFit(candidate,genre,{now=new Date(),owner=null,history=[],historyOwner=null}={}){
 if(!genre||!rules[genre])return null;
 const personal=candidate.source_kind==='personal_history'||candidate.source==='食事履歴'||candidate.source==='ナビの本人記録';
 const c=candidate.genre_external||candidate;
 const evidence=[],rule=rules[genre];let time_checked=false;
 const result=(level,reason)=>({genre,level,evidence,time_checked,reason});
 const add=(source,text)=>evidence.push({source,provider:source==='personal_meal'?'本人食事履歴':c.source_kind||c.source||'既存候補情報',text:String(text)});
 const scoped=text=>/ランチ|昼食|昼は|昼限定|lunch/i.test(text);
 const evaluate=(text,source,level)=>{if(!text||!dishes[genre].test(clean(text)))return null;add(source,text);if(scoped(text)) {const active=lunchTime(c,text,now);time_checked=active!==null;return active===true?level:active===false?'unknown':'weak';}return level;};
 // Keep provenance separate: cached HP tags may have been inferred from the name.
 const tags=personal?[]:c.hotpepper?(c.hotpepper.genre?[c.hotpepper.genre,c.hotpepper.sub_genre]:[]):c.tags||[];
 const menu=personal?'':c.history_dish?'':c.dish||'';
 const information=[['menu',menu,'strong'],['menu',c.menu||'','strong'],['lunch',c.hotpepper?.lunch||'','strong'],['description',c.meal_evidence||'','strong'],['description',c.description||'','weak']];
 let levels=[];
 for(const [source,text,level] of information){const found=evaluate(text,source,level);if(found)levels.push(found);}
 // Lunch-only descriptions must not be promoted by their derived generic tags.
 const lunchOnly=information.some(([,text])=>scoped(text)&&rule.test(clean(text)));
 for(const text of [...tags,c.cuisine||'']){if(!text||!rule.test(clean(text)))continue;add('category',text);levels.push(lunchOnly&&genre==='定食'?'unknown':'strong');}
 for(const r of history){
  const meta=r.navi_metadata||{};const who=r.user_id||r.owner_id||historyOwner;
  if(!owner||owner==='guest'||who!==owner||r.is_test===true||r.exclude_from_learning===true||r.use_for_learning===false||meta.is_test===true||meta.exclude_from_learning===true)continue;
  if(!candidate.store_id||r.store_id!==candidate.store_id)continue;
  const text=[r.confirmed_values?.dish_name??r.dish_name,r.confirmed_values?.genre??r.genre].filter(Boolean).join(' '),date=new Date(r.eaten_at||r.created_at);
  if(!Number.isFinite(date.getTime())||date>now||!rule.test(clean(text)))continue;
  const mealPeriod=d=>hour(d)>=11&&hour(d)<15?'lunch':hour(d)>=17?'dinner':'other';
  time_checked=true;if(mealPeriod(date)!==mealPeriod(now))continue;
  add('personal_meal',text+'（'+date.toISOString()+'・現在の提供は要確認）');levels.push((now-date)/86400000<=180?'strong':'weak');
 }
 if(genre==='定食'&&outsidePublishedHours(c,now)){time_checked=true;return result('unknown','掲載営業時間外の可能性・定食提供は要確認');}
 if(levels.includes('strong'))return result('strong',genre==='定食'&&lunchOnly?'ランチ定食の提供情報あり（当日は要確認）':genre+'の料理・業態情報あり（当日は要確認）');
 const sweetCategory=[...tags,c.cuisine||'',c.amenity==='ice_cream'?'ice_cream':'',menu].some(t=>sweets.test(t));
 const sweetSpecialist=sweetCategory||(sweets.test(c.name||'')&&['cafe','fast_food'].includes(c.amenity));
 if(sweetSpecialist){add('category','甘味・菓子業態。指定ジャンルの料理情報なし');return result('mismatch','甘味・菓子業態で指定料理の根拠なし');}
 if(levels.includes('weak'))return result('weak','提供情報あり・時間帯や現在の内容は要確認');
 if(levels.includes('unknown'))return result('unknown','対象時間帯の提供は情報不足・要確認');
 if(rule.test(clean(c.name))){add('name',c.name);return result('weak','店名のみの手掛かり・料理提供は要確認');}
 return result('unknown','ジャンル適合は情報不足・要確認');
}
export const genreStrength=fit=>({strong:3,weak:1,unknown:0,mismatch:0}[fit?.level]??0);
