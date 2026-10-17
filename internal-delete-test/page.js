import {loadPublicConfig} from '../api.js';
import {MealClient} from '../meal-client.js';
import {DeleteTest} from './runner.js';
const $=id=>document.getElementById(id);let runner,busy=false;
function render(){const l=runner?.ledger;$('target').textContent=l?JSON.stringify({test_id:l.id,storage_path:l.path,test_marker:l.meal.navi_metadata.delete_test.kind,phase:l.phase},null,2):'未作成';$('create').disabled=busy||!!l&&l.phase!=='prepared';$('inspect').disabled=busy||!l;$('remove').disabled=busy||!l||!['saved','deleting','done'].includes(l.phase);}
async function run(action){if(busy)return;busy=true;render();$('result').textContent='確認中…';try{await action();}catch{$('result').textContent='処理の完了を確認できません。対象IDは保持しています。新しい記録を作らず、同じページで再確認してください。';}finally{busy=false;render();}}
async function syntheticPhoto(){const c=document.createElement('canvas');c.width=256;c.height=192;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,256,192);g.fillStyle='#164';g.font='16px sans-serif';g.fillText('DELETE TEST ONLY',20,60);g.fillText(crypto.randomUUID().slice(0,16),20,100);const b=await new Promise(r=>c.toBlob(r,'image/png'));if(!b)throw Error();return new File([b],'delete-test.png',{type:'image/png'});}
$('create').onclick=()=>run(async()=>{if(!runner.ledger)await runner.prepare(await syntheticPhoto());await runner.create();$('result').textContent=JSON.stringify(await runner.inspect(),null,2);});
$('inspect').onclick=()=>run(async()=>{$('result').textContent=JSON.stringify(await runner.inspect(),null,2);});
$('remove').onclick=()=>{if(!confirm('このページで作成した一時テスト記録とテスト画像だけを削除します。元に戻せません。実行しますか？'))return;void run(async()=>{await runner.remove();$('result').textContent=JSON.stringify(await runner.inspect(),null,2);});};
try{const config=await loadPublicConfig(new URL('../',location.href).href);runner=new DeleteTest(new MealClient(config,localStorage),localStorage);await runner.init();$('auth').textContent='本人ログイン確認済み（既存セッションを引継ぎ）';$('controls').hidden=false;render();}catch{$('auth').textContent='この検証はハラケン本人専用です。現在のセッションでは本人確認を完了できません。';$('controls').hidden=true;}
