import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommend,DEFAULT_CONTEXT,operating} from '../domain.js';
import {buildPool} from '../discovery.js';
const now=new Date('2026-11-08T15:30:00Z'); // Monday JST, Sunday UTC
const store=(id,extra={})=>({id,name:id,dish:'大盛プレート',kind:'store',mode:'both',search_scoped:true,price:1000,travel_minutes:1,...extra});
for(const mode of ['eat','drink'])test('basic closed weekday excludes in '+mode,()=>{
 const rows=[store('closed',{closed_weekdays:[1]}),store('open',{closed_weekdays:[2]}),store('unknown'),store('empty',{closed_weekdays:[]})];
 const r=recommend(rows,{...DEFAULT_CONTEXT,mode,storesOnly:true},[],{},[],now);
 assert.deepEqual(r.ranked.map(c=>c.id).sort(),['empty','open','unknown']);
 assert.equal(recommend([rows[0]],{...DEFAULT_CONTEXT,mode,storesOnly:true},[],{},[],now).top.length,0);
});
test('master weekday survives external candidate pooling',()=>{
 const ctx={...DEFAULT_CONTEXT,storesOnly:true};
 const pool=buildPool({candidates:[store('ext',{store_id:'master',discovered:true})]}, {stores:{data:[{id:'master',name:'ext',closed_weekdays:[1]}]}},[],[],ctx);
 const external=pool.find(c=>c.id==='ext');
 assert.deepEqual(external.closed_weekdays,[1]);assert.equal(operating(external,[],now).available,false);
});
test('unknown genre reason describes only portion',()=>{
 const c=recommend([store('meal')],{...DEFAULT_CONTEXT,category:'その他',portion:'ガッツリ',storesOnly:true},[],{},[],now).top[0];
 assert.equal(c.genre_fit,null);assert.equal(c.portion_fit,'fit');
 assert.equal(c.reason,'ガッツリの量に合う提供情報あり（量は要確認）');assert.ok(!c.reason.includes('その他'));
});
test('strong genre reason unchanged',()=>{
 const c=recommend([store('焼肉店',{tags:['焼肉']})],{...DEFAULT_CONTEXT,category:'肉',portion:'ガッツリ',storesOnly:true},[],{},[],now).top[0];
 assert.equal(c.genre_fit.level,'strong');assert.equal(c.reason,c.genre_fit.reason+'・ガッツリの量は要確認');
});
