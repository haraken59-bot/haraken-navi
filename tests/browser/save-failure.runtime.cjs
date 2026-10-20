const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd();
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{let body=fs.readFileSync(p);if(p.endsWith('index.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');res.setHeader('Content-Type',/\.(mjs|js)$/.test(p)?'text/javascript':'text/html');res.end(body);}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const origin='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await page.goto(origin+'/index.html');
 const result=await page.evaluate(async()=>{
  const {mountMealUI}=await import('/meal-ui.js');let saves=0,release;const entered=new Promise(r=>release=r);let complete;const blocked=new Promise(r=>complete=r);const owner='11111111-1111-4111-8111-111111111111';
  const client={session:()=>({user:{id:owner}}),fresh:async()=>({user:{id:owner}}),mealRpc:async()=>{saves++;release();await blocked;},historyPage:async()=>[],stores:async()=>[]};
  mountMealUI({getClient:()=>client,getOwner:()=>owner,getContext:()=>({}),getDecision:()=>null,getTest:()=>false,onSaved:async()=>{throw Error('display refresh failed');},onRefresh:async()=>{}});
  document.getElementById('actual-rating').value='4';document.getElementById('actual-store').value='架空テスト店';
  const form=document.getElementById('record-form'),event={preventDefault(){}};const first=form.onsubmit(event);await entered;await form.onsubmit(event);const single=saves===1;complete();await first;
  return {single,refreshFailureHandled:document.getElementById('meal-status').textContent.includes('再登録は不要'),saves,buttonEnabled:!form.querySelector('button[type=submit]').disabled};
 });assert.deepEqual(result,{single:true,refreshFailureHandled:true,saves:1,buttonEnabled:true});console.log(JSON.stringify({passed:2,failed:0,result}));
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

