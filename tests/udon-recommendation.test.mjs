import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend} from '../domain.js';
const base={mode:'eat',category:'おまかせ',transport:'walk',weather:'unknown',occasion:'normal',companions:1,round:1,region:'福岡市'};
const candidate=(id,name,tags=[])=>({id,name,kind:'store',mode:'eat',tags,latitude:33.59,longitude:130.42});
test('explicit udon excludes ramen-only shops and retains udon shops',()=>{
 const ramen=candidate('ramen','らーめん 二男坊 博多本店',['麺']);
 const udon=candidate('udon','博多うどん店',['うどん']);
 const result=recommend([ramen,udon],{...base,desire:'うどん'});
 assert.equal(result.ranked.some(c=>c.id==='ramen'),false);
 assert.equal(result.ranked.some(c=>c.id==='udon'),true);
});
test('broad noodle wish does not exclude ramen by specific udon filter',()=>{
 const ramen=candidate('ramen','らーめん 二男坊 博多本店',['麺']);
 const result=recommend([ramen],{...base,desire:'麺類'});
 assert.equal(result.ranked.some(c=>c.id==='ramen'),true);
});
