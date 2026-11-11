import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discoveryParams, effectiveHint, DiscoveryController} from '../discovery.js';

const params = (category, desire) => discoveryParams({category, desire, mode: 'eat', area: '藤崎', region: '福岡市'});

test('魚 + やきにく: category=魚, no hint (conflicting genre suppressed)', () => {
  const p = params('魚', 'やきにく');
  assert.equal(p.get('category'), '魚');
  assert.equal(p.get('hint'), null);
});
test('肉 + やきにく: category=肉, hint kept (genres agree)', () => {
  const p = params('肉', 'やきにく');
  assert.equal(p.get('category'), '肉');
  assert.equal(p.get('hint'), 'やきにく');
});
test('おまかせ + やきにく: hint kept (no button)', () => {
  assert.equal(params('おまかせ', 'やきにく').get('hint'), 'やきにく');
});
test('魚 + さかな: category=魚, hint kept (hiragana fish agrees)', () => {
  const p = params('魚', 'さかな');
  assert.equal(p.get('category'), '魚');
  assert.equal(p.get('hint'), 'さかな');
});
test('魚 + 空欄: category=魚, no hint', () => {
  const p = params('魚', '');
  assert.equal(p.get('category'), '魚');
  assert.equal(p.get('hint'), null);
});
test('魚 + にく: hiragana meat conflicts -> no hint', () => {
  assert.equal(params('魚', 'にく').get('hint'), null);
});
test('麺 + ラーメン: agree -> hint kept', () => {
  assert.equal(params('麺', 'ラーメン').get('hint'), 'ラーメン');
});
test('定食 + やきにく: conflict -> no hint', () => {
  assert.equal(params('定食', 'やきにく').get('hint'), null);
});
test('魚 + 家で食べる: no genre implied -> hint unchanged (no conflict)', () => {
  assert.equal(params('魚', '家で食べる').get('hint'), '家で食べる');
});
test('おまかせ + 空欄: no hint', () => {
  assert.equal(params('おまかせ', '').get('hint'), null);
});
test('effectiveHint equivalence: 魚+やきにく equals 魚+空欄', () => {
  assert.equal(effectiveHint({category: '魚', desire: 'やきにく'}), effectiveHint({category: '魚', desire: ''}));
});
test('controller: conflicting input then cleared input share one cached search; changed hint re-searches', async () => {
  const calls = [];
  const payload = () => ({candidates: [], center: {latitude: 33.58, longitude: 130.35}, radius_m: 1200, fetched_at: new Date().toISOString()});
  const request = async (url) => { calls.push(url); return {ok: true, json: async () => payload()}; };
  const ctl = new DiscoveryController(request, null);
  const base = {location: {latitude: 33.58, longitude: 130.35}, area: '', region: '福岡市', mode: 'eat', portion: '', budget: null, direction: ''};
  await ctl.search({...base, category: '魚', desire: 'やきにく'});
  assert.equal(calls.length, 1);
  assert.equal(new URLSearchParams(calls[0].split('?')[1]).get('hint'), null);
  assert.equal(new URLSearchParams(calls[0].split('?')[1]).get('category'), '魚');
  await ctl.search({...base, category: '魚', desire: ''});
  assert.equal(calls.length, 1, 'clearing the conflicting text reuses the same cache entry');
  await ctl.search({...base, category: '魚', desire: 'さかな'});
  assert.equal(calls.length, 2, 'agreeing hint is a different effective request');
  assert.equal(new URLSearchParams(calls[1].split('?')[1]).get('hint'), 'さかな');
  await ctl.search({...base, category: '肉', desire: 'やきにく'});
  assert.equal(calls.length, 3);
  assert.equal(new URLSearchParams(calls[2].split('?')[1]).get('hint'), 'やきにく');
});
