import assert from 'node:assert/strict';
import {specificDishMatch} from '../domain.js';

const ctx=(desire,category='肉')=>({desire,category});
const yakitori={name:'やきとり ひだか',dish:'焼き鳥',tags:['肉']};
const steak={name:'ステーキ店',dish:'ステーキ',tags:['肉']};
const yakiniku={name:'焼肉店',dish:'焼肉',tags:['肉']};
const unknown={name:'食堂',dish:'料理未確認',tags:['肉']};
assert.equal(specificDishMatch(yakitori,ctx('やきとり')),1);
assert.equal(specificDishMatch(steak,ctx('やきとり')),0);
assert.equal(specificDishMatch(yakiniku,ctx('やきとり')),0);
assert.equal(specificDishMatch(unknown,ctx('やきとり')),0);
assert.equal(specificDishMatch(yakiniku,ctx('焼肉')),1);
assert.equal(specificDishMatch(yakitori,ctx('','肉')),0);
assert.equal(specificDishMatch(yakitori,ctx('','おまかせ')),0);
console.log('specific-dish: 7 assertions passed');
