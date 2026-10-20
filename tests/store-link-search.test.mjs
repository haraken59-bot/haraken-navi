import assert from 'node:assert/strict';
import {storeNameKey,matchingStores,visibleStoreRows,storeCandidateRank,storeListStatus,verifiedManualStore,confirmManualStore} from '../store-link-ui.js';
const stores=[{name:'焼鳥 にわ とりのすけ 西新店'},{name:'やきとり ひだか'},{name:'寿司の店'}];
assert.equal(storeNameKey(' やきとり・ひだか '),storeNameKey('焼鳥ひだか'));
assert.equal(matchingStores(stores,'焼き鳥 ひだか')[0]?.name,'やきとり ひだか');
assert.equal(matchingStores(stores,'にわ とりのすけ').length,1);
assert.equal(matchingStores(stores,'寿司').length,1);
assert.equal(matchingStores(stores,'不明な店').length,0);
assert.equal(matchingStores(stores,'').length,3);
assert.deepEqual(visibleStoreRows(stores,'寿司').map(x=>x.i),[2],'filtered index still references original candidate');
assert.deepEqual(visibleStoreRows(stores,'').map(x=>x.i),[0,1,2],'clearing name filter exposes all GPS candidates');
const ranked=[{name:'やきとりひだか',address:'福岡市早良区西新',distance_m:450},{name:'やきとり ひだか',address:'福岡市早良区西新',distance_m:200},{name:'やきとりひだか',address:'福岡市中央区',distance_m:40}];
assert.deepEqual(visibleStoreRows(ranked,'やきとり ひだか','福岡市早良区西新').map(x=>x.i),[1,0,2],'matching address and distance rank candidates without automatic confirmation');
assert.equal(storeCandidateRank(ranked[0],'やきとりひだか').exact,true);
assert.deepEqual(visibleStoreRows(ranked,'').map(x=>x.i),[2,1,0],'distance orders unfiltered GPS candidates');
assert.equal(visibleStoreRows(ranked,'').length,3,'ranking never drops GPS candidates');
assert.match(storeListStatus(stores,''),/すべて表示/);
assert.match(storeListStatus(stores,'存在しない'),/一致がありません/);
assert.match(storeListStatus(stores,'寿司'),/一致する登録店舗/);
assert.match(storeListStatus([],''),/登録店舗がありません/);
console.log('store link search: 16 assertions passed');

import {readFileSync} from 'node:fs';
const clientSource=readFileSync(new URL('../meal-client.js',import.meta.url),'utf8');



const photo={latitude:32.74333,longitude:129.8757236111111};
assert.deepEqual(verifiedManualStore('万徳','32.744','129.876',photo),{name:'万徳',latitude:32.744,longitude:129.876});
for(const [lat,lng] of [['','129.876'],['abc','129.876'],['32.744abc','129.876'],['91','129.876'],['32.744','181'],['0','0'],[String(photo.latitude),String(photo.longitude)]])assert.equal(verifiedManualStore('万徳',lat,lng,photo),null,'invalid manual coordinate rejected');
assert.equal(verifiedManualStore('','32.744','129.876',photo),null,'name required');

let writes=0,links=0;
const client={stores:async()=>[],confirmStore:async()=>{writes++;return 'store-id';}};
const onSelect=async()=>{links++;};
const candidate={name:'万徳',latitude:32.744,longitude:129.876};
assert.equal(await confirmManualStore({candidate,approved:false,client,onSelect}),false);
assert.equal(await confirmManualStore({candidate:null,approved:true,client,onSelect}),false);
assert.equal(await confirmManualStore({candidate,approved:true,client,onSelect,isCurrent:()=>false}),false);
assert.equal(writes,0,'cancel and stale dialogs must not write');
assert.equal(links,0,'cancel and stale dialogs must not link');
assert.equal(await confirmManualStore({candidate,approved:true,client,onSelect}),true);
assert.equal(writes,1,'explicit approval writes once');
assert.equal(links,1,'explicit approval links once');

const uiSource=readFileSync(new URL('../store-link-ui.js',import.meta.url),'utf8');
const manualStart=uiSource.indexOf("dialog.querySelector('[data-manual]').onclick");
const mapLink=uiSource.indexOf("status.replaceChildren('住所を確認しました。'",manualStart);
const nextClick=uiSource.indexOf('next.onclick=async()=>',manualStart);
const coordinatePrompt=uiSource.indexOf("const latitude=prompt(",manualStart);
assert.ok(manualStart>=0&&mapLink>manualStart&&nextClick>mapLink&&coordinatePrompt>nextClick,'map link is presented before coordinates are prompted on a separate click');
assert.match(uiSource,/if\(!confirm\('店舗名：'/,'manual registration requires explicit final confirmation');
assert.match(uiSource,/confirmManualStore\(\{candidate,approved:true,client,onSelect,isCurrent:current\}\)/,'manual registration uses guarded write helper');

assert.match(uiSource,/if\(validPoint\(point\)&&String\(initialName\|\|''\)\.trim\(\)\)await near\.onclick\(\)/,'auto-search when both photo GPS and saved name exist');

assert.match(uiSource,/const matched=visibleStoreRows\(rows,initialName,referenceAddress\)/,'prefer name-matching nearby candidates');
assert.match(uiSource,/input\.value=matched\.length\?String\(initialName\|\|''\):''/,'show all nearby candidates when name match is absent');

assert.match(uiSource,/registeredRows=rows/,'registered stores retained as fallback');
assert.match(uiSource,/rows=found\.length\?\[\.\.\.found,\.\.\.registeredRows\.filter/,'registered stores remain available beside external photo results');




import {linkedStoreId,resolveStoreSelection} from '../store-link-ui.js';
const existingId='11111111-1111-4111-8111-111111111111';
assert.equal(linkedStoreId({id:'hotpepper:J0001'}),null,'provider ID must not be used as DB store UUID');
assert.equal(linkedStoreId({id:'hotpepper:J0001',store_id:existingId}),existingId,'existing store UUID takes priority');
assert.equal(linkedStoreId({id:existingId}),existingId,'registered store row ID remains valid');
let externalConfirms=0;
const lookupClient={stores:async()=>[],confirmStore:async()=>{externalConfirms++;return existingId;}};
assert.equal(await resolveStoreSelection(lookupClient,{id:'hotpepper:J0001',name:'External'}),existingId);
assert.equal(externalConfirms,1,'external candidates must be explicitly confirmed');
assert.equal(await resolveStoreSelection(lookupClient,{id:'hotpepper:J0001',store_id:existingId}),existingId);
assert.equal(externalConfirms,1,'known registered store must not be registered again');

import {recoverStoreLink} from '../store-link-ui.js';
{
 const candidate={name:'焼鳥ひだか',latitude:33.59,longitude:130.4};
 const id='11111111-1111-4111-8111-111111111111';
 let links=0;
 const client={stores:async()=>[{id,name:'やきとり ひだか',latitude:33.59,longitude:130.4}]};
 assert.equal(await recoverStoreLink({client,candidate,onSelect:async s=>{assert.equal(s.id,id);links++;}}),true);
 assert.equal(links,1);
 assert.equal(await recoverStoreLink({client:{stores:async()=>[...(await client.stores()),...(await client.stores())]},candidate,onSelect:async()=>{throw Error('ambiguous link');}}),false);
 assert.equal(await recoverStoreLink({client,candidate,onSelect:async()=>{throw Error('stale');},isCurrent:()=>false}),false);
 await assert.rejects(recoverStoreLink({client:{stores:async()=>{throw Error('network');}},candidate,onSelect:async()=>{}}),/network/);
}

{
 const candidate={name:'同名の店',latitude:33.59,longitude:130.4};
 const nearby={id:'11111111-1111-4111-8111-111111111111',name:'同名の店',latitude:33.5901,longitude:130.4};
 let linked=false;
 assert.equal(await recoverStoreLink({client:{stores:async()=>[nearby]},candidate,onSelect:async()=>{linked=true;}}),false,'nearby same-name business must not be linked automatically');
 assert.equal(linked,false);
}

{
 const {sameStoreLocation}=await import('../store-link-ui.js');
 const id='11111111-1111-4111-8111-111111111111';
 const candidate={id:'hotpepper:J001',name:'同じ店舗',latitude:33.59,longitude:130.4};
 let creates=0;
 const existing={id,name:'同じ店舗',latitude:33.59,longitude:130.4};
 assert.equal(sameStoreLocation(existing,candidate),true);
 assert.equal(await resolveStoreSelection({stores:async()=>[existing],confirmStore:async()=>{creates++;}},candidate),id);
 assert.equal(creates,0,'registered store is reused without a write');
 await assert.rejects(resolveStoreSelection({stores:async()=>[existing,existing],confirmStore:async()=>{creates++;}},candidate),/複数/);
 assert.equal(creates,0,'ambiguous same-name stores must not create or link');
 const other={...existing,latitude:33.5901};
 assert.equal(sameStoreLocation(other,candidate),false,'different floor/building location is not silently matched');
}

{
 const candidate={id:'hotpepper:J009',name:'同名の店',latitude:33.59,longitude:130.4};
 let creates=0;
 const client={stores:async()=>[{id:'11111111-1111-4111-8111-111111111111',name:'同名の店',latitude:33.591,longitude:130.4}],confirmStore:async()=>{creates++;}};
 await assert.rejects(resolveStoreSelection(client,candidate),/場所を確認/);
 assert.equal(creates,0,'same-name different-location store requires manual review before create');
}

assert.match(clientSource,/filterNearbyPhotoStores\(data.candidates,point,hint\)/);
