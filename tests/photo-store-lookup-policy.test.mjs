import assert from 'node:assert/strict';
import {shouldSearchExactStore} from '../photo-store-lookup-policy.mjs';
assert.equal(shouldSearchExactStore({photoStoreLookup:false,hint:'万徳',candidates:[]}),false);
assert.equal(shouldSearchExactStore({photoStoreLookup:true,hint:'',candidates:[]}),false);
assert.equal(shouldSearchExactStore({photoStoreLookup:true,hint:'万徳',candidates:[{name:'他の飲食店'}]}),true);
assert.equal(shouldSearchExactStore({photoStoreLookup:true,hint:'万徳',candidates:[{name:'万徳'}]}),false);
assert.equal(shouldSearchExactStore({photoStoreLookup:true,hint:'焼き鳥 日高',candidates:[{name:'焼鳥日高'}]}),true);
