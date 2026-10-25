import test from 'node:test';import assert from 'node:assert/strict';
import {filterNearbyPhotoStores,photoNameKey,photoNameMatches} from '../photo-store-candidates.js';
const point={latitude:0,longitude:135},id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const row=(meters,n=1,extra={})=>({id:id(n),name:'餃子菜館 万徳',latitude:meters/6371000*180/Math.PI,longitude:135,...extra});
test('inclusive 500m boundary, just inside/outside; name never extends range',()=>{const rows=[row(499.999,1),row(500,2),row(500.001,3),row(700,4)];assert.deepEqual(filterNearbyPhotoStores(rows,point,'万徳').map(r=>r.id),[id(1),id(2)]);});
test('unregistered/external, closed, test, missing and invalid GPS excluded',()=>{const rows=[row(10),row(20,2,{id:'hotpepper:X'}),row(30,3,{closed:true}),row(40,4,{is_test:true}),row(50,5,{latitude:NaN})];assert.equal(filterNearbyPhotoStores(rows,point).length,1);assert.deepEqual(filterNearbyPhotoStores(rows,null),[]);assert.deepEqual(filterNearbyPhotoStores(rows,{latitude:0,longitude:0}),[]);});
test('only same UUID is deduplicated; different same-name stores preserved',()=>{const a=row(10);assert.equal(filterNearbyPhotoStores([a,a,row(10,2)],point).length,2);});
test('name aliases/width/whitespace and descriptive prefix match only as hints',()=>{assert.equal(photoNameKey('　萬徳 '),photoNameKey('万徳'));assert.equal(photoNameMatches('餃子菜館 萬徳','万徳'),true);assert.equal(photoNameMatches('万徳','餃子菜館 万徳'),true);assert.equal(photoNameMatches('ＡＢＣ　万徳','abc万徳'),true);assert.equal(photoNameMatches('別のお店','万徳'),false);});
test('more than 100 registered nearby stores remain available on clearing filter',()=>{assert.equal(filterNearbyPhotoStores(Array.from({length:101},(_,i)=>row(i,i+1)),point,'万徳').length,101);});
