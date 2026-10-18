import assert from 'node:assert/strict';
import {storeNameKey,matchingStores,visibleStoreRows,storeCandidateRank,storeListStatus,verifiedManualStore} from '../store-link-ui.js';
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
assert.match(clientSource,/\.\.\.\(hint\?\{hint\}:\{\}\)/,'named photo lookup passes optional hint');


assert.match(clientSource,/match\(a\)-match\(b\)/,'name matches are ranked ahead of 20-item cap');

const photo={latitude:32.74333,longitude:129.8757236111111};
assert.deepEqual(verifiedManualStore('万徳','32.744','129.876',photo),{name:'万徳',latitude:32.744,longitude:129.876});
for(const [lat,lng] of [['','129.876'],['abc','129.876'],['32.744abc','129.876'],['91','129.876'],['32.744','181'],['0','0'],[String(photo.latitude),String(photo.longitude)]])assert.equal(verifiedManualStore('万徳',lat,lng,photo),null,'invalid manual coordinate rejected');
assert.equal(verifiedManualStore('','32.744','129.876',photo),null,'name required');
