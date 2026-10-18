import assert from 'node:assert/strict';
import test from 'node:test';
import {saveMealWithPhotos} from '../meal-photo.js';

const owner='11111111-1111-4111-8111-111111111111';
const mealId='22222222-2222-4222-8222-222222222222';
const imageId='33333333-3333-4333-8333-333333333333';
const meal={id:mealId,navi_metadata:{}};
const photo={id:imageId,fingerprint:'a'.repeat(64),file:{size:10,type:'image/jpeg'},original_info:{}};
function client({upload=async()=>{},save=async()=>{},fresh=async()=>({user:{id:owner}})}={}){
 const calls={uploads:[],deletes:[],saves:[]};
 return {calls,fresh,async uploadOriginal(...args){calls.uploads.push(args);return upload(...args);},async removePendingOriginals(paths){calls.deletes.push(paths);},async mealRpc(...args){calls.saves.push(args);return save(...args);}};
}
test('successful save keeps original metadata',async()=>{
 const c=client();
 const result=await saveMealWithPhotos(c,meal,[photo]);
 assert.equal(c.calls.saves.length,1);
 assert.equal(result.navi_metadata.original_photos.length,1);
 assert.equal(c.calls.deletes.length,0);
});
test('upload failure never deletes previously committed originals',async()=>{
 const c=client({upload:async()=>{throw Error('network failure');}});
 await assert.rejects(saveMealWithPhotos(c,meal,[photo]),/network failure/);
 assert.equal(c.calls.deletes.length,0);
 assert.equal(c.calls.saves.length,0);
});
test('rejected DB save preserves originals',async()=>{
 const c=client({save:async()=>{throw Object.assign(Error('duplicate'),{saveRejected:true});}});
 await assert.rejects(saveMealWithPhotos(c,meal,[photo]),/duplicate/);
 assert.equal(c.calls.deletes.length,0);
});
test('ambiguous DB timeout preserves originals',async()=>{
 const c=client({save:async()=>{throw Error('timeout');}});
 await assert.rejects(saveMealWithPhotos(c,meal,[photo]),/timeout/);
 assert.equal(c.calls.deletes.length,0);
});
test('account switch prevents database write',async()=>{
 let n=0;
 const c=client({fresh:async()=>({user:{id:++n===1?owner:'44444444-4444-4444-8444-444444444444'}})});
 await assert.rejects(saveMealWithPhotos(c,meal,[photo]),/アカウントが変わりました/);
 assert.equal(c.calls.saves.length,0);
});
