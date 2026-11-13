import test from 'node:test';
import assert from 'node:assert/strict';
import {selectStore} from '../session.js';

test('T35: same candidate re-selection increments selection_seq',()=>{
 const decision={id:'decision-1',status:'presented',latest_choice:null};
 const candidate={id:'store-1',store_id:'uuid-1',name:'同じ店舗',latitude:33.5,longitude:130.3};
 const first=selectStore(decision,candidate,'2026-11-13T00:00:00Z');
 const second=selectStore(first,candidate,'2026-11-13T00:01:00Z');
 assert.equal(first.selection_seq,1);
 assert.equal(second.selection_seq,2);
 assert.equal(second.id,decision.id);
 assert.deepEqual(second.latest_choice,first.latest_choice);
 assert.equal(second.transitions.length,2);
});

test('T35: legacy decisions without sequence start at one',()=>{
 const selected=selectStore({id:'old',latest_choice:null},{id:'s',name:'店舗'});
 assert.equal(selected.selection_seq,1);
});
