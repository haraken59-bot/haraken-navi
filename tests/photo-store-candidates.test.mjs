import test from 'node:test';
import assert from 'node:assert/strict';
import {filterNearbyPhotoStores,photoNameKey} from '../photo-store-candidates.js';
const origin={latitude:32.742920,longitude:129.875415};
const candidate=(delta,name='餃子菜館 万徳',extra={})=>({name,latitude:origin.latitude+delta,longitude:origin.longitude,address:'長崎県長崎市銅座町2-2',...extra});
test('known official name appears for manually entered 万徳 at same GPS',()=>{
 const result=filterNearbyPhotoStores([candidate(0)],origin,'万徳');
 assert.equal(result.length,1);assert.equal(result[0].name,'餃子菜館 万徳');assert.equal(result[0].distance_m,0);
});
test('500m normal radius, name-matched extension to 1km, and exclusion beyond 1km',()=>{
 const rows=[candidate(.001,'別の店'),candidate(.00449,'別の店'),candidate(.005,'別の店'),candidate(.005,'餃子菜館 万徳'),candidate(.00898,'餃子菜館 万徳'),candidate(.01,'餃子菜館 万徳')];
 const result=filterNearbyPhotoStores(rows,origin,'万徳');
 assert.equal(result.length,4);
 assert.equal(result.filter(x=>x.name==='別の店').length,2);
 assert.equal(result.filter(x=>x.name==='餃子菜館 万徳').length,2);
 assert.ok(result[0].name.includes('万徳'),'name matches rank before nearer unrelated shops');
});
test('no hint never extends beyond 500m',()=>assert.equal(filterNearbyPhotoStores([candidate(.005)],origin).length,0));
test('GPS absent, zero point, and invalid candidate are safe',()=>{
 assert.deepEqual(filterNearbyPhotoStores([candidate(0)],null,'万徳'),[]);
 assert.deepEqual(filterNearbyPhotoStores([candidate(0)],{latitude:0,longitude:0},'万徳'),[]);
 assert.deepEqual(filterNearbyPhotoStores([candidate(0,'万徳',{latitude:NaN})],origin,'万徳'),[]);
});
test('closed shops are excluded; duplicate name does not imply identity',()=>{
 const rows=[candidate(0,'餃子菜館 万徳',{closed:true}),candidate(.001,'餃子菜館 万徳'),candidate(.002,'餃子菜館 万徳')];
 assert.equal(filterNearbyPhotoStores(rows,origin,'万徳').length,2);
});
test('normalization removes spacing but does not silently conflate variant kanji',()=>{
 assert.equal(photoNameKey('餃子菜館　万徳'),'餃子菜館万徳');
 assert.notEqual(photoNameKey('萬徳'),photoNameKey('万徳'));
});
