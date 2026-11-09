const {chromium}=require('C:/Users/User/Documents/Codex/2026-09-12/referenced-chatgpt-conversation-this-is-an-2/outputs/meal-importer/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8140';
(async()=>{let browser,server,page;const checks=[],requests=[],errors=[];
try{
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,origin),f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(u.pathname==='/public-config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:'https://vflxbadvyilfjoypnhtx.supabase.co',publishableKey:'sb_publishable_synthetic_wb1'}));return;}
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(f);if(u.pathname==='/main.js')body=Buffer.from(body.toString()+'\nwindow.__wb1=()=>({ctx:{...ctx},result,guestActive});');
  res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(body);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8140,'127.0.0.1',resolve);});
 browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({serviceWorkers:'block'});
 await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async r=>{
  const u=new URL(r.request().url());if(u.origin===origin){await r.continue();return;}
  if(u.pathname==='/functions/v1/navi-discover'&&u.searchParams.get('mode')==='guest-discover'){
   requests.push({area:u.searchParams.get('area'),hint:u.searchParams.get('hint'),mode:u.searchParams.get('mealMode')});
   const center={latitude:33.583,longitude:130.36,label:'西新'},c={id:'synthetic-yakitori',name:'合成焼き鳥店',dish:'焼き鳥',tags:['焼き鳥'],kind:'store',mode:'both',discovered:true,source_kind:'hotpepper',latitude:33.5831,longitude:130.36,price:1000,travel_minutes:1,observed_at:new Date().toISOString()};
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[c],center,radius_m:500,fetched_at:new Date().toISOString()})});return;
  }
  await r.abort();
 });
 await page.goto(origin);await page.waitForFunction(()=>typeof window.__wb1==='function');
 await page.locator('#entry-guest').click({force:true});await page.locator('#area').fill('西新');await page.locator('#desire').fill('焼き鳥');
 await page.locator('#recommend').click();await page.waitForFunction(()=>window.__wb1().result?.top?.length>0);
 assert.equal(await page.evaluate(()=>window.__wb1().guestActive),true);
 const before=await page.evaluate(()=>JSON.stringify(window.__wb1().result));
 await page.locator('#mode-eat').click();assert.equal(await page.locator('#desire').inputValue(),'焼き鳥');
 assert.equal(await page.locator('#mode-eat').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__wb1().result)),before);checks.push('same-mode: desire/selection/results retained');
 await page.locator('#mode-drink').click();assert.equal(await page.locator('#desire').inputValue(),'');assert.equal(await page.evaluate(()=>window.__wb1().ctx.category),'おまかせ');
 assert.equal(await page.evaluate(()=>window.__wb1().result),null);assert.equal(await page.locator('#mode-drink').getAttribute('aria-pressed'),'true');checks.push('mode-change: desire/category/results reset');
 await page.locator('#mode-eat').click();await page.locator('#desire').fill('焼き鳥');await page.locator('#now').click();
 await page.waitForFunction(()=>!document.querySelector('#now').disabled&&window.__wb1().result?.top?.length>0);
 const state=await page.evaluate(()=>window.__wb1());assert.equal(state.ctx.desire,'焼き鳥');assert.equal(await page.locator('#desire').inputValue(),'焼き鳥');
 assert.equal(state.result.top[0].id,'synthetic-yakitori');assert.ok(state.result.top[0].match>0);assert.ok(requests.some(x=>x.area==='西新'&&x.hint==='焼き鳥'));
 checks.push('startNow: desire retained and used by recommendation');assert.deepEqual(errors,[]);
 const result={success:true,checks,origin,area:'西新',guest:true,discovery:'browser route synthetic response',requests,realExternalRequests:0,status:await page.locator('#discovery-status').textContent()};
 fs.writeFileSync(path.join(root,'WB1-MOOD-ACCEPTANCE-20261109.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({success:false,checks,error:e.message,status:page?await page.locator('#discovery-status').textContent().catch(()=>null):null,errors}));process.exitCode=1;}
finally{await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));}})();
