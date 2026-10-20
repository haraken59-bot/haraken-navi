import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMealStoreId} from '../meal-store-id.js';

const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const stores=[{id,name:'餃子菜館 万徳'},{id:other,name:'別の店'}];

test('explicit selection retains matching store ID',()=>{
 assert.equal(resolveMealStoreId(stores,id,'餃子菜館 万徳',null),id);
});
test('matching recommended ID is retained without dropdown selection',()=>{
 assert.equal(resolveMealStoreId(stores,'','餃子菜館 万徳',{store_id:id,name:'餃子菜館 万徳'}),id);
});
test('manual name mismatch never links the recommendation',()=>{
 assert.equal(resolveMealStoreId(stores,'','万徳',{store_id:id,name:'餃子菜館 万徳'}),null);
});
test('unknown recommended UUID never links an unrelated store',()=>{
 assert.equal(resolveMealStoreId(stores,'','餃子菜館 万徳',{store_id:'33333333-3333-4333-8333-333333333333'}),null);
});
test('no recommendation preserves unlinked manual save',()=>{
 assert.equal(resolveMealStoreId(stores,'','万徳',null),null);
});
test('explicit matching selection wins over different recommendation',()=>{
 assert.equal(resolveMealStoreId(stores,id,'餃子菜館 万徳',{store_id:other}),id);
});
