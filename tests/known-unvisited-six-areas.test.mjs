import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnownStoreReader,mergeKnownStores} from '../supabase/functions/navi-discover/known-stores.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='99999999-9999-4999-8999-999999999999';
const center={latitude:32.74,longitude:129.88};
const id=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const row=(n,name,latitude=32.74,longitude=129.88,used=false,revisited=false)=>({store_id:id(n),name,latitude,longitude,used,revisited});
function mock(rows){
 const calls=[];
 const db={withConnection:async callback=>callback({query:async(sql,args)=>{calls.push({sql,args});return {rows};}})};
 return {read:createKnownStoreReader(db,owner),calls};
}
test('1: invalid coordinates and identifiers are excluded; SQL-side exclusions must be checked separately',async()=>{
 const {read}=mock([row(1,'有効'),row(2,'緯度不正',91),row(3,'経度不正',32.74,181),{...row(4,'不正ID'),store_id:'invalid'},row(5,'',32.74)]);
 assert.deepEqual((await read(center,500)).map(x=>x.name),['有効']);
 assert.deepEqual(await read({latitude:32.74,longitude:129.88},3001),[]);
});
test('2: unvisited, first visit, second visit statuses',async()=>{
 for(const [used,revisited,expected] of [[false,false,'unvisited'],[true,false,'used'],[true,true,'revisited']]){
  const {read}=mock([row(1,'訪問状態',32.74,129.88,used,revisited)]);
  assert.equal((await read(center,500))[0].haraken_usage,expected);
 }
});
test('3: GPS radius boundary and invalid input',async()=>{
 const {read}=mock([row(1,'中心'),row(2,'近距離',32.744),row(3,'遠方',32.75)]);
 assert.deepEqual((await read(center,500)).map(x=>x.name),['中心','近距離']);
 assert.deepEqual(await read({latitude:NaN,longitude:129.88},500),[]);
 assert.deepEqual(await read(center,0),[]);
});
test('4: duplicate matching and nonmatching branches',async()=>{
 const {read}=mock([row(1,'餃子菜館 万徳')]);const known=await read(center,500);
 const ext={id:'ext:1',name:'餃子菜館 万徳',latitude:32.74,longitude:129.88};
 const merged=mergeKnownStores([ext],known);
 assert.equal(merged.length,1);assert.equal(merged[0].haraken_usage,'unvisited');
 const distant=mergeKnownStores([{...ext,latitude:32.75}],known);assert.equal(distant.length,2);
 const otherName=mergeKnownStores([{...ext,name:'別店舗'}],known);assert.equal(otherName.length,2);
});
test('4b: ambiguous duplicate is not forcibly linked',async()=>{
 const {read}=mock([row(1,'同名店')]);const known=await read(center,500);
 const result=mergeKnownStores([{id:'a',name:'同名店',...center},{id:'b',name:'同名店',...center}],known);
 assert.equal(result.length,2);assert.ok(result.every(x=>!x.store_id));
});
test('5: owner is bound to the parameterized DB query; invalid owner short circuits',async()=>{
 const {read,calls}=mock([row(1,'本人店舗')]);await read(center,500);
 assert.equal(calls.length,1);assert.match(calls[0].sql,/guest_known_stores\(\$1::uuid/);
 assert.equal(calls[0].args[0],owner);
 assert.notEqual(calls[0].args[0],other);
 const bad=createKnownStoreReader({withConnection:()=>{throw Error('must not connect');}},'not-a-uuid');
 assert.deepEqual(await bad(center,500),[]);
});
test('6: many candidates remain bounded and merge output stable',async()=>{
 const rows=Array.from({length:500},(_,i)=>row(i+1,`候補${i}`));
 const {read}=mock(rows);const known=await read(center,500);
 assert.equal(known.length,50);
 const merged=mergeKnownStores([],known);
 assert.equal(merged.length,50);
 assert.equal(new Set(merged.map(x=>x.id)).size,50);
});
