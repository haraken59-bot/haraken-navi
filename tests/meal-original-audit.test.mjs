import assert from 'node:assert/strict';
import test from 'node:test';
import {auditOriginalReferences} from '../meal-original-audit.js';
const owner='11111111-1111-4111-8111-111111111111',meal='22222222-2222-4222-8222-222222222222';
const original=id=>owner+'/'+meal+'/'+id+'_'+('a'.repeat(64))+'.jpg';
const a=original('33333333-3333-4333-8333-333333333333');
const b=original('44444444-4444-4444-8444-444444444444');
const rows=[{id:meal,navi_metadata:{original_photos:[{path:a}]}}];
test('audit never deletes referenced originals',()=>{
 const result=auditOriginalReferences({owner,objects:[a,b],meals:rows,complete:true});
 assert.deepEqual(result.candidates,[]);assert.deepEqual(result.unverified,[b]);assert.equal(result.canDelete,false);
});
test('incomplete history cannot mark orphan candidates as confirmed',()=>{
 const result=auditOriginalReferences({owner,objects:[a,b],meals:rows});
 assert.deepEqual(result.candidates,[]);assert.deepEqual(result.unverified,[b]);
 assert.equal(result.canDelete,false);
});
test('foreign and invalid paths cannot be considered cleanup candidates',()=>{
 const result=auditOriginalReferences({owner,objects:[b,'other-user/'+meal+'/x.jpg','../danger'],meals:[],complete:true});
 assert.deepEqual(result.candidates,[]);assert.deepEqual(result.unverified,[b]);assert.equal(result.invalid.length,2);
});

test('malformed metadata is reported conservatively without deletion',()=>{
 const result=auditOriginalReferences({owner,objects:[b],meals:[{id:meal,navi_metadata:{original_photos:{unexpected:true}}},{id:meal,navi_metadata:{original_photos:[null]}}],complete:true});
 assert.deepEqual(result.candidates,[]);assert.deepEqual(result.unverified,[b]);assert.equal(result.canDelete,false);
});
