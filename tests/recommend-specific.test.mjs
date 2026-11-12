import assert from 'node:assert/strict';
import {recommend,DEFAULT_CONTEXT} from '../domain.js';
const now=new Date('2026-10-18T10:00:00+09:00');
const store=(id,name,dish,tags)=>({id,name,dish,tags,mode:'eat',kind:'store',observed_at:now.toISOString(),travel_minutes:5,price:1800,search_scoped:true});
const stores=[store('steak','ステーキ店','ステーキ',['肉']),store('yakitori','やきとり ひだか','焼き鳥',['肉','焼き鳥']),store('yakiniku','焼肉店','焼肉',['肉'])];
const rank=(desire,category)=>recommend(stores,{...DEFAULT_CONTEXT,desire,category,storesOnly:true},[],{},[],now).top.map(x=>x.id);
assert.equal(rank('やきとり','肉')[0],'yakitori','specific dish outranks broad meat');
assert.equal(rank('焼肉','肉')[0],'yakiniku','yakiniku outranks other meat');
assert.equal(rank('','肉').length,3,'broad meat still returns three stores');
assert.equal(rank('','おまかせ').length,3,'omakase still returns three stores');
const fishStores=[...stores,store('sushi','寿司店','寿司',['魚','寿司']),store('seafood','魚料理店','刺身',['魚'])];
const rankFish=(desire,category)=>recommend(fishStores,{...DEFAULT_CONTEXT,desire,category,storesOnly:true},[],{},[],now).top.map(x=>x.id);
assert.equal(rankFish('やきとり','魚')[0],'seafood','genre button outranks conflicting specific dish (NAVI-05 ranking spec)');
assert.equal(rankFish('寿司','肉')[0],'steak','meat category outranks conflicting sushi desire (NAVI-05 ranking spec)');
assert.ok(['sushi','seafood'].includes(rankFish('','魚')[0]),'fish category works without desire');
assert.equal(rankFish('','おまかせ').length,3,'omakase still works');
console.log('recommend integration: 8 assertions passed');

// NAVI-05 spec B: genre and specific-dish ranking are independent axes.
import {requestedGenre,genreFit} from '../genre-fit.js';
const genreCases=[
 ['魚','やきとり','魚'],['おまかせ','やきとり','肉'],
 ['おまかせ','にく','肉'],['おまかせ','さかな','魚'],['おまかせ','やきにく','肉'],
 ['魚','家で食べる',null],['魚','','魚']
];
for(const [category,desire,expected] of genreCases)assert.equal(requestedGenre({category,desire}),expected,`confirmed genre: ${category} + ${desire}`);
for(const [dish,genre] of [['にく','肉'],['やきにく','肉'],['さかな','魚']])assert.equal(genreFit({dish},genre).level,'strong',`hiragana menu evidence: ${dish}`);
assert.equal(genreFit({name:'情報なし'},'魚').level,'unknown','unknown genre is not mismatch');
console.log('NAVI-05 genre axis: 11 assertions passed (7 required + 4 related)');
