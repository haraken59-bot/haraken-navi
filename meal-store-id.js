import {normalizeStoreName} from './importer/records.js';
import {distanceKm,validPoint} from './places.js';

// NAVI-15-B: decide which store master record a saved meal links to.
// Branch 1: an explicit dropdown selection whose name still matches the input.
// Branch 2: the recommendation session's latest choice, only while every
// confirmed condition holds (master exists, normalized name matches the input,
// distance to the master is at most 80m, no area contradiction, and the store
// name was not edited after the selection). Owner consistency is structural:
// the decision handed in here always belongs to the current owner's state.
// Anything else stays unlinked; a name alone never links another store.
const validCoord=p=>validPoint(p)&&!(p.latitude===0&&p.longitude===0);
export function selectionSeqOf(decision){const s=decision?.selection_seq;return Number.isSafeInteger(s)&&s>=0?s:0;}
export function selectionKey(decision){return decision?.id?decision.id+':'+selectionSeqOf(decision):null;}
export function nameEditApplies(editKey,decision){return editKey!=null&&editKey===selectionKey(decision);}
export function resolveMealStoreId(stores,selectedId,actualName,latestChoice,nameEdited=false){
 const list=Array.isArray(stores)?stores:[];
 const name=normalizeStoreName(actualName);
 const selected=list.find(s=>s.id===selectedId&&normalizeStoreName(s.name)===name);
 if(selected)return selected.id;
 if(nameEdited)return null;
 if(!latestChoice?.store_id)return null;
 const master=list.find(s=>s.id===latestChoice.store_id);
 if(!master||normalizeStoreName(master.name)!==name)return null;
 if(!validCoord(latestChoice)||!validCoord(master))return null;
 if(distanceKm(latestChoice,master)*1000>80)return null;
 const choiceArea=normalizeStoreName(latestChoice.area),masterArea=normalizeStoreName(master.area);
 if(choiceArea&&masterArea&&choiceArea!==masterArea)return null;
 return master.id;
}
