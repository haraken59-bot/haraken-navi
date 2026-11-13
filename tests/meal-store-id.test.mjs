import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMealStoreId,selectionKey,nameEditApplies} from '../meal-store-id.js';
import {selectStore} from '../session.js';
import {normalizeStoreName} from '../importer/records.js';
import {distanceKm} from '../places.js';

// NAVI-15-B test design v02: A-group T1-T24 (judgment function) and
// B-group T25-T34 (state transitions, exercised through the same key
// primitives meal-ui.js uses: selectionKey / nameEditApplies / selectStore).
const base={latitude:33.5809,longitude:130.3485};
const near={latitude:33.58095,longitude:130.34855};
const storeA={id:'uuid-a',name:'やきとり日高',area:'西新',...base};
const storeB={id:'uuid-b',name:'ラーメン一番',area:'西新',latitude:33.582,longitude:130.3496};
const choiceA={store_id:'uuid-a',name:'やきとり日高',area:'西新',...near};
const choiceB={store_id:'uuid-b',name:'ラーメン一番',area:'西新',latitude:33.58205,longitude:130.34965};
const stores=[storeA,storeB];
const latOffsetForMeters=m=>{let lo=0,hi=0.01;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(distanceKm(base,{...base,latitude:base.latitude+mid})*1000<m)lo=mid;else hi=mid;}return (lo+hi)/2;};

test('T1: explicit selection with matching name returns its UUID',()=>{
 assert.equal(resolveMealStoreId(stores,'uuid-a','やきとり日高',null),'uuid-a');
});
test('T2: latest_choice satisfying every condition returns its UUID',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',choiceA),'uuid-a');
});
test('T3: input name differing from the choice returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','別の店',choiceA),null);
});
test('T4: latest_choice store_id missing from the master returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,store_id:'uuid-unknown'}),null);
});
test('T5: no latest_choice returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',null),null);
});
test('T6: branch 1 wins when explicit selection and recommendation differ',()=>{
 assert.equal(resolveMealStoreId(stores,'uuid-b','ラーメン一番',choiceA),'uuid-b');
});
test('T7: choice coordinates over 80m from its master return null, same-name neighbour is not picked',()=>{
 const neighbour={id:'uuid-a2',name:'やきとり日高',area:'西新',latitude:33.5828,longitude:130.3485};
 const farChoice={...choiceA,latitude:33.58275,longitude:130.3485};
 assert.equal(resolveMealStoreId([storeA,neighbour],'','やきとり日高',farChoice),null);
});
test('T8: area present on both sides and different returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,area:'天神'}),null);
});
test('T9: latest_choice without coordinates returns null',()=>{
 const {latitude,longitude,...noCoords}=choiceA;
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',noCoords),null);
});
test('T10: branch 1 ignores distance',()=>{
 assert.equal(resolveMealStoreId(stores,'uuid-a','やきとり日高',{...choiceA,latitude:33.7,longitude:130.5}),'uuid-a');
});
test('T11: discovered choice without store_id returns null',()=>{
 const {store_id,...discovered}=choiceA;
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',discovered),null);
});
test('T12: area missing on one side does not block',()=>{
 const noAreaMaster={...storeA,area:''};
 assert.equal(resolveMealStoreId([noAreaMaster,storeB],'','やきとり日高',choiceA),'uuid-a');
 const {area,...noAreaChoice}=choiceA;
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',noAreaChoice),'uuid-a');
});
test('T13: identical coordinates but conflicting area returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,...base,area:'博多'}),null);
});
test('T14: partially missing choice coordinates return null',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,longitude:undefined}),null);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,latitude:undefined}),null);
});
test('T15: master without coordinates returns null',()=>{
 const {latitude,longitude,...noCoordMaster}=storeA;
 assert.equal(resolveMealStoreId([noCoordMaster,storeB],'','やきとり日高',choiceA),null);
});
test('T16: (0,0) coordinates are treated as missing',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',{...choiceA,latitude:0,longitude:0}),null);
 const zeroMaster={...storeA,latitude:0,longitude:0};
 assert.equal(resolveMealStoreId([zeroMaster,storeB],'','やきとり日高',choiceA),null);
});
test('T17: after re-selection only the newest choice is judged',()=>{
 assert.equal(resolveMealStoreId(stores,'','ラーメン一番',choiceB),'uuid-b');
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',choiceB),null);
});
test('T18: a same-name store elsewhere in the master does not affect the result',()=>{
 const other={id:'uuid-a9',name:'やきとり日高',area:'天神',latitude:33.59,longitude:130.42};
 assert.equal(resolveMealStoreId([storeA,other,storeB],'','やきとり日高',choiceA),'uuid-a');
});
test('T19: name edited to a different name returns null',()=>{
 assert.equal(resolveMealStoreId(stores,'','別の店',choiceA,true),null);
});
test('T20: name edited back to the original still returns null while the edit flag stands',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',choiceA,true),null);
});
test('T21: same candidate re-selected (edit flag cleared) links when conditions hold',()=>{
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',choiceA,false),'uuid-a');
});
test('T22: after switching candidates only the new candidate is judged',()=>{
 assert.equal(resolveMealStoreId(stores,'','ラーメン一番',choiceB,false),'uuid-b');
});
test('T23: branch 1 still applies while the branch-2 edit flag stands',()=>{
 assert.equal(resolveMealStoreId(stores,'uuid-a','やきとり日高',choiceA,true),'uuid-a');
});
test('T24: the 80m boundary is inclusive',()=>{
 const inside={...choiceA,latitude:base.latitude+latOffsetForMeters(79.95),longitude:base.longitude};
 const outside={...choiceA,latitude:base.latitude+latOffsetForMeters(80.05),longitude:base.longitude};
 assert.ok(distanceKm(inside,storeA)*1000<=80);
 assert.ok(distanceKm(outside,storeA)*1000>80);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',inside),'uuid-a');
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',outside),null);
});

// B-group: state transitions. meal-ui.js records an edit as
// selectionKey(decision) at edit time and passes
// nameEditApplies(recordedKey, currentDecision) to the judgment.
const candidateA={id:'cand-a',store_id:'uuid-a',name:'やきとり日高',area:'西新',...near};
const freshDecision=()=>({id:'d1',status:'recommended',initial_choice:null,latest_choice:null,transitions:[]});

test('T25: a new recommendation session discards the old edit state',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 assert.equal(nameEditApplies(editKey,d),true);
 assert.equal(nameEditApplies(editKey,{...freshDecision(),id:'d2'}),false);
});
test('T26: logout / account switch discards the old edit state',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 assert.equal(nameEditApplies(editKey,null),false);
 assert.equal(nameEditApplies(editKey,{...freshDecision(),id:'other-owner-decision'}),false);
});
test('T27: programmatic fill from a selection does not raise the edit flag',()=>{
 const d=selectStore(freshDecision(),candidateA);
 assert.equal(nameEditApplies(null,d),false);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,nameEditApplies(null,d)),'uuid-a');
});
test('T28: re-selecting the identical candidate clears the invalidation',()=>{
 let d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 assert.equal(nameEditApplies(editKey,d),true);
 d=selectStore(d,candidateA);
 assert.equal(d.selection_seq,2);
 assert.equal(nameEditApplies(editKey,d),false);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,nameEditApplies(editKey,d)),'uuid-a');
});
test('T29: clearing the invalidation does not guarantee linking when conditions fail',()=>{
 let d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 d=selectStore(d,candidateA);
 const moved={...storeA,latitude:base.latitude+0.003};
 assert.equal(resolveMealStoreId([moved,storeB],'','やきとり日高',d.latest_choice,nameEditApplies(editKey,d)),null);
});
test('T30: free-text parse changing the store name invalidates branch 2',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const before='やきとり日高',after='別の店';
 const editKey=after!==before?selectionKey(d):null;
 assert.equal(nameEditApplies(editKey,d),true);
 assert.equal(resolveMealStoreId(stores,'',after,d.latest_choice,nameEditApplies(editKey,d)),null);
});
test('T31: free-text parse changing only the notation (raw value differs) invalidates branch 2',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const before='やきとり 日高',after='やきとり日高';
 assert.equal(normalizeStoreName(before),normalizeStoreName(after));
 assert.notEqual(before,after);
 const editKey=after!==before?selectionKey(d):null;
 assert.equal(resolveMealStoreId(stores,'',after,d.latest_choice,nameEditApplies(editKey,d)),null);
});
test('T32: free-text parse leaving the store name unchanged keeps the state',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const before='やきとり日高',after='やきとり日高';
 const editKey=after!==before?selectionKey(d):null;
 assert.equal(nameEditApplies(editKey,d),false);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,false),'uuid-a');
 const priorEdit=selectionKey(d);
 const editKeyAfterParse=after!==before?selectionKey(d):priorEdit;
 assert.equal(nameEditApplies(editKeyAfterParse,d),true);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,true),null);
});
test('T33: typing the original name back after a parse change keeps the invalidation',()=>{
 const d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 assert.equal(nameEditApplies(editKey,d),true);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,nameEditApplies(editKey,d)),null);
});
test('T34: re-selecting a candidate after a parse change restores eligibility',()=>{
 let d=selectStore(freshDecision(),candidateA);
 const editKey=selectionKey(d);
 d=selectStore(d,candidateA);
 assert.equal(nameEditApplies(editKey,d),false);
 assert.equal(resolveMealStoreId(stores,'','やきとり日高',d.latest_choice,nameEditApplies(editKey,d)),'uuid-a');
});
