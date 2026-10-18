import {withinSearch} from '../../../app/places.js';
import {genreFit,requestedGenre} from '../../../app/genre-fit.js';
import {mergeKnownStores} from './known-stores.mjs';
export const RADII=[500,1000,2000,3000];
export const safeHint=v=>String(v||'').normalize('NFKC').replace(/[^\p{L}\p{N}\sー]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60);
export function searchTerms(input){const q=safeHint(input.hint|| (input.category==='おまかせ'?'':input.category));if(!q)return [];const family=/やきとり|焼き鳥|焼鳥|串焼/.test(q)?['焼き鳥','串焼き','居酒屋']:/麺|ラーメン|うどん|そば/.test(q)?['ラーメン','うどん','そば','麺類']:/中華|餃子|炒飯/.test(q)?['中華料理','餃子','炒飯']:[];return [...new Set([q,...family])];}
export async function adaptiveNearby({input,center,load,knownStores=async()=>[],now=()=>Date.now()}){
 const terms=searchTerms(input),ctx={desire:safeHint(input.hint),category:input.category||'おまかせ'},genre=requestedGenre(ctx);
 let external=[],known=[],radius=500,partial=false,fetched_at=new Date(now()).toISOString(),failed=false;
 let successes=0;const attempted=[],searched=[],providerKeys=new Set();const MAX_PROVIDER_REQUESTS=6;
 const add=value=>{external=[...new Map([...external,...value.candidates].map(c=>[c.id,c])).values()];partial=partial||value.partial;fetched_at=value.fetched_at||fetched_at;};
 const pool=()=>withinSearch(mergeKnownStores(external,known),center,radius);
 const eligible=()=>pool().filter(c=>!c.closed&&!c.permanently_closed&&(!c.mode||c.mode==='both'||c.mode===input.mode)&&genreFit(c,genre)?.level!=='mismatch');
 const q=terms[0]||'',matchingTerms=/やきとり|焼き鳥|焼鳥|串焼/.test(q)?['やきとり','焼き鳥','焼鳥','串焼']:/麺|ラーメン|うどん|そば/.test(q)?['麺','ラーメン','うどん','そば']:/中華|餃子|炒飯/.test(q)?['中華','中華料理','餃子','炒飯']:terms.slice(0,1);
 const matches=c=>{if(!terms.length)return true;const text=[c.name,c.dish,c.meal_evidence,...(c.tags||[])].join(' ').normalize('NFKC');return matchingTerms.some(t=>text.includes(t));};
 const enough=()=>{const rows=eligible();if(input.photoStoreLookup&&q)return rows.some(c=>String(c.name||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').includes(q.replace(/[\s・･ー－-]/g,'')));return rows.length>=6&&(!terms.length||rows.filter(matches).length>=3);};
 const query=async(keyword='')=>{const k=radius+':'+keyword;if(providerKeys.has(k))return true;if(providerKeys.size>=MAX_PROVIDER_REQUESTS){partial=true;return false;}providerKeys.add(k);try{add(await load(radius,keyword));successes++;if(keyword)searched.push(keyword);return true;}catch{failed=true;return false;}};
 for(const r of RADII){radius=r;attempted.push(r);try{known=await knownStores(center,r);}catch{known=[];}
  if(!await query())break;
  if(enough())break;
  // One original-keyword request near the user, only if broad retrieval is insufficient.
  if(terms.length&&(r===500||input.photoStoreLookup)&&!enough()){if(!await query(terms[0]))break;if(enough())break;}
 }
 // At most one related term: never turn an AND keyword query into an unrelated genre.
 if(!enough()&&terms.length>1&&!failed)await query(terms[1]);
 if(!successes&&!known.length)throw Error('search_unavailable');
 return {candidates:pool(),radius_m:radius,search_radii:attempted,search_terms:searched,partial:partial||failed||Boolean(input.photoStoreLookup&&q&&!enough()),fetched_at};
}
