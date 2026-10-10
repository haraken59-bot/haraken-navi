export function takeoutStatus(c){
 const value=c.takeaway??c.takeout;
 if(value===true||['yes','only'].includes(value))return {state:'available',source:'店舗の持ち帰り属性',evidence:String(value)};
 if(value===false||value==='no')return {state:'unavailable',source:'店舗の持ち帰り属性',evidence:String(value)};
 const text=[c.meal_evidence,c.description,c.hotpepper?.takeout].filter(Boolean).join(' ');
 if(/(?:テイクアウト|持ち帰り)(?:は|に)?(?:不可|非対応|対応していません|できません)/.test(text))return {state:'unavailable',source:c.source||'店舗情報',evidence:text};
 if(/(?:テイクアウト|持ち帰り)(?:も|は|に)?(?:可能|可(?:能)?|対応|できます|OK)/i.test(text))return {state:'available',source:c.source||'店舗情報',evidence:text};
 return {state:'unknown',source:null,evidence:null};
}
export const wantsOutside=ctx=>/外に出たい|外出したい|飲みに行きたい|店で食べたい/.test(ctx.desire||'');
// Reuse already ranked, available stores and their existing genre/portion fit.
export function actionAlternatives(result,ctx){
 const takeout=result.ranked.find(c=>c.kind==='store'&&takeoutStatus(c).state==='available'&&(!c.genre_fit||['strong','weak'].includes(c.genre_fit.level))&&!(ctx.portion==='ガッツリ'&&c.portion_fit==='unsuitable'));
 const options=['home','wait'].map(id=>result.ranked.find(c=>c.id===id)).filter(Boolean);
 if(takeout)options.unshift({...takeout,id:'takeout:'+takeout.id,base_candidate_id:takeout.id,visit_mode:'takeout',takeout_evidence:takeoutStatus(takeout),reason:'持ち帰り対応の掲載情報あり。対象料理・当日の受付は要確認。'});
 return options.filter(c=>!result.top.some(t=>t.id===c.id));
}
