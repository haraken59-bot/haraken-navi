import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOfferPostSaveStoreLink} from '../post-save-store-policy.js';

const photo={latitude:32.7401,longitude:129.8801};
const meal=(overrides={})=>({store_id:null,unlinked_store_name:'万徳',navi_metadata:{photo_location:photo,latest_choice:null},...overrides});

test('manually entered, unlinked meal with photo GPS opens confirmation',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal()),true);
});
test('already linked store never opens confirmation',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({store_id:'11111111-1111-4111-8111-111111111111'})),false);
});
test('recommendation matching saved store is not reidentified',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({navi_metadata:{photo_location:photo,latest_choice:{name:'万徳'}}})),false);
});
test('different recommended store does not suppress manual visit identification',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({navi_metadata:{photo_location:photo,latest_choice:{name:'別の店'}}})),true);
});
test('photo without GPS remains safely unlinked',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({navi_metadata:{photo_location:null,photo_locations:[]}})),false);
});
test('empty store name remains safely unlinked',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({unlinked_store_name:''})),false);
});

test('missing photo metadata leaves meal unlinked',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({navi_metadata:null})),false);
});
test('variant kanji are not treated as an exact recommendation match',()=>{
 assert.equal(shouldOfferPostSaveStoreLink(meal({navi_metadata:{photo_location:photo,latest_choice:{name:'萬徳'}}})),true);
});
