import test from 'node:test';
import assert from 'node:assert/strict';
import {saveMealWithPhotos} from '../meal-photo.js';
import {MealClient} from '../meal-client.js';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const meal={id,navi_metadata:{}};
const photo={id:'33333333-3333-4333-8333-333333333333',fingerprint:'a'.repeat(64),file:{size:1,type:'image/jpeg'},original_info:{}};
test('ambiguous commit retry preserves meal ID and photo path (mock idempotent RPC)',async()=>{
 const rows=new Map(),objects=new Set(),paths=[];let attempts=0,deletes=0;
 const c={fresh:async()=>({user:{id:owner}}),uploadOriginal:async p=>{objects.add(p);paths.push(p);},removePendingOriginals:async()=>deletes++,mealRpc:async(_,v)=>{rows.set(v.meal.id,v.meal);if(++attempts===1)throw Error('response lost after commit');}};
 await assert.rejects(saveMealWithPhotos(c,meal,[photo]));await saveMealWithPhotos(c,meal,[photo]);
 assert.equal(rows.size,1);assert.equal(objects.size,1);assert.equal(paths[0],paths[1]);assert.equal(deletes,0);
});
test('partial upload failure retains first original and does not save DB',async()=>{
 let uploads=0,saves=0,deletes=0;const c={fresh:async()=>({user:{id:owner}}),uploadOriginal:async()=>{if(++uploads===2)throw Error('upload interrupted');},mealRpc:async()=>saves++,removePendingOriginals:async()=>deletes++};
 await assert.rejects(saveMealWithPhotos(c,meal,[photo,{...photo,id:'44444444-4444-4444-8444-444444444444'}]));assert.equal(uploads,2);assert.equal(saves,0);assert.equal(deletes,0);
});
test('link update failure never invokes meal creation and sends no photo or meal-content patch',async()=>{
 const calls=[];const c={fresh:async()=>({access_token:'synthetic'}),send:async(path,body)=>{calls.push({path,body});throw Error('response lost');}};
 await assert.rejects(MealClient.prototype.editMeal.call(c,{id,revision:3},{store_id:owner}));
 assert.deepEqual(calls,[{path:'/rest/v1/rpc/edit_meal_details',body:{meal_id:id,expected_revision:3,patch:{store_id:owner}}}]);
});
