import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recommend, recommendSearch, DEFAULT_CONTEXT} from '../domain.js';
import {effectiveHint} from '../discovery.js';

// NAVI-05 ranking spec: with a genre button selected, genre fit is compared
// before the specific-dish key. With おまかせ, the legacy dish-first order stays.
const now = new Date('2026-11-11T18:00:00+09:00');
const store = (id, name, dish, tags, extra = {}) => ({id, name, dish, tags, mode: 'eat', kind: 'store', observed_at: now.toISOString(), travel_minutes: 5, price: 1800, search_scoped: true, ...extra});
const fish = [store('donmaru', '福岡どん丸 藤崎駅前店', '海鮮丼', ['魚', '海鮮']), store('seikichi', '鮨と和の食 清吉', '寿司', ['魚', '寿司'])];
const yakiniku = store('gokumiya', '極味や 焼肉 藤崎店', '焼肉', ['肉', '焼肉']);
const ctx = (category, desire) => ({...DEFAULT_CONTEXT, category, desire, storesOnly: true, area: '藤崎'});
const topIds = (pool, c) => recommend(pool, c, [], {}, [], now).top.map(x => x.id);

test('1. 魚 + やきにく: genre-fit fish stores outrank the yakiniku store in the same pool', () => {
  const ids = topIds([...fish, yakiniku], ctx('魚', 'やきにく'));
  assert.ok(ids.indexOf('donmaru') < ids.indexOf('gokumiya'), 'fish store above yakiniku');
  assert.notEqual(ids[0], 'gokumiya');
});

test('2. 肉 + やきにく: yakiniku store is first', () => {
  const steak = store('steak', 'ステーキ店', 'ステーキ', ['肉']);
  assert.equal(topIds([steak, yakiniku], ctx('肉', 'やきにく'))[0], 'gokumiya');
});

test('3. おまかせ + やきにく: legacy dish priority keeps yakiniku first', () => {
  assert.equal(topIds([...fish, yakiniku], ctx('おまかせ', 'やきにく'))[0], 'gokumiya');
});

test('4. 魚 + 刺身: within fish stores, the sashimi-evidenced store is first', () => {
  const sashimi = store('sashimi', '刺身の店', '刺身定食', ['魚']);
  const grilled = store('grilled', '焼き魚の店', '焼き魚', ['魚']);
  assert.equal(topIds([grilled, sashimi], ctx('魚', '刺身'))[0], 'sashimi');
});

test('5. 麺 + ラーメン: within noodle stores, the ramen store is first', () => {
  const ramen = store('ramen', 'ラーメン店', 'ラーメン', ['麺']);
  const udon = store('udon', 'うどん店', 'うどん', ['麺']);
  assert.equal(topIds([udon, ramen], ctx('麺', 'ラーメン'))[0], 'ramen');
});

test('6. 魚 + 空欄: fish stores are first', () => {
  const ids = topIds([...fish, yakiniku], ctx('魚', ''));
  assert.ok(['donmaru', 'seikichi'].includes(ids[0]));
});

test('7. no fish store in pool: stores are still returned and unmatched is flagged', () => {
  const teishoku = store('teishoku', '定食店', '定食', ['定食']);
  const r = recommend([yakiniku, teishoku], ctx('魚', 'やきにく'), [], {}, [], now);
  assert.ok(r.top.length > 0, 'fallback candidates are still presented');
  assert.equal(r.unmatched, true);
});

test('8. genre-unknown store with a dish match never outranks a genre-confirmed store', () => {
  const unknownDish = store('mystery', '謎の店', '焼肉', []);
  const r = recommend([unknownDish, ...fish], ctx('魚', 'やきにく'), [], {}, [], now);
  const mystery = r.ranked.find(x => x.id === 'mystery');
  assert.equal(mystery.genre_fit.level, 'unknown');
  assert.ok(r.top.findIndex(x => x.id === 'mystery') === -1 || r.top.indexOf(mystery) > r.top.findIndex(x => x.id === 'donmaru'), 'unknown-fit store stays below confirmed fish');
  assert.notEqual(r.top[0].id, 'mystery');
});

test('9. same genre fit: the specific-dish match decides', () => {
  const steak = store('steak', 'ステーキ店', 'ステーキ', ['肉']);
  const ids = topIds([steak, yakiniku], ctx('肉', '焼肉'));
  assert.equal(ids[0], 'gokumiya');
});

test('10. dish text matching nothing: ordering falls back to genre fit without errors', () => {
  const ids = topIds([...fish, yakiniku], ctx('魚', 'カレー'));
  assert.ok(['donmaru', 'seikichi'].includes(ids[0]));
});

test('11. genre and dish tied: the existing score decides (higher satisfaction first)', () => {
  const hi = store('fish-hi', '満足度の高い魚店', '寿司', ['魚'], {satisfaction: 5});
  const lo = store('fish-lo', '満足度の低い魚店', '寿司', ['魚'], {satisfaction: 3});
  assert.equal(topIds([lo, hi], ctx('魚', ''))[0], 'fish-hi');
});

test('12. full tie: the existing stable id order is kept and reproducible', () => {
  const a = store('fish-a', '魚店A', '寿司', ['魚']);
  const b = store('fish-b', '魚店B', '寿司', ['魚']);
  const first = topIds([b, a], ctx('魚', ''));
  const second = topIds([b, a], ctx('魚', ''));
  assert.deepEqual(first, second, 'same input gives the same order');
  assert.equal(first[0], 'fish-a', 'id ascending tiebreak is preserved');
});

test('13. discovery + ranking integration: conflicting ctx sends no hint and ranks fish first', () => {
  const c = ctx('魚', 'やきにく');
  assert.equal(effectiveHint(c), '', 'PR #16 discovery behavior is unchanged');
  const discovered = [...fish, yakiniku].map(s => ({...s, discovered: true, source_kind: 'known_store'}));
  const r = recommendSearch(discovered, c, [], {}, [], now);
  assert.notEqual(r.top[0].id, 'gokumiya');
  assert.equal(r.top[0].genre_fit.level, 'strong');
});

test('14. other genres behave the same way (中華 + 餃子, 定食 + やきにく)', () => {
  const gyoza = store('gyoza', '餃子の中華店', '餃子', ['中華']);
  const mapo = store('mapo', '麻婆豆腐の中華店', '麻婆豆腐', ['中華']);
  assert.equal(topIds([mapo, gyoza], ctx('中華', '餃子'))[0], 'gyoza');
  const teishoku = store('teishoku', '定食店', '焼き定食', ['定食']);
  assert.equal(topIds([yakiniku, teishoku], ctx('定食', 'やきにく'))[0], 'teishoku');
});

test('15. boundary inputs do not throw and keep fish first', () => {
  for (const desire of ['   ', '！！！', 'やきにく'.repeat(40), '魚 魚 魚']) {
    const ids = topIds([...fish, yakiniku], ctx('魚', desire));
    assert.ok(ids.length > 0, `no crash for desire=${JSON.stringify(desire.slice(0, 12))}`);
  }
  assert.ok(['donmaru', 'seikichi'].includes(topIds([...fish, yakiniku], ctx('魚', '   '))[0]), 'whitespace-only desire behaves like empty');
});
