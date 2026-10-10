import {hidakaContext,navigationContext,ownerSafe} from './hidaka-context.js';
export const PROJECT='https://vflxbadvyilfjoypnhtx.supabase.co';
export const SESSION_KEY='haraken-navi-supabase-session-v1';
export const OTP_WAIT_MS=60000;
export async function loadPublicConfig(href,request=fetch){
 const page=new URL(href);
 const development=['http://127.0.0.1:8140','http://localhost:8140','https://supreme-each-undrafted.ngrok-free.dev'].includes(page.origin);
 try{
  let response=await request(new URL('./public-config.json',page),{cache:'no-store',signal:AbortSignal.timeout(10000)});
  // Running development servers may predate the static configuration route.
  // Production never falls back to a Node endpoint.
  if(development&&response.status===404)response=await request(new URL('/api/public-config',page),{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error();
  return validateConfig(await response.json());
 }catch{throw Error('接続設定を読み込めませんでした。外出テストの起動状態を確認して再読み込みしてください。');}
}
export class OtpAuthError extends Error {}
export class OtpFlow {
 constructor(client,now=Date.now){this.client=client;this.now=now;this.until=0;this.busy=false;this.email='';}
 remaining(){return Math.max(0,Math.ceil((this.until-this.now())/1000));}
 async send(email){if(this.busy||this.remaining())throw new OtpAuthError('少し待ってから再度お試しください。');this.busy=true;try{await this.client.sendEmailOtp(email);this.email=email.trim();this.until=this.now()+OTP_WAIT_MS;}catch(e){if(e.status===429)this.until=this.now()+OTP_WAIT_MS;throw e;}finally{this.busy=false;}}
 async verify(token){if(this.busy||!this.email)throw new OtpAuthError('先に認証コードを送信してください。');this.busy=true;try{return await this.client.verifyOtp(this.email,token);}finally{this.busy=false;}}
 changeEmail(){if(!this.busy)this.email='';} // Keep cooldown across address changes.
}
// Reused from Hidaka order supabase-connection.js: authRedirectUrl,
// consumeAuthRedirect, /auth/v1/otp (create_user:false), persistent refresh flow.
export function authRedirectUrl(href){const url=new URL(href);if(!['http:','https:'].includes(url.protocol))throw Error('ローカルサーバーのURLから開いてください。');url.search='';url.hash='';return url.href;}
export function consumeAuthRedirect(location,history){
 const params=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
 if(!['access_token','refresh_token','error','error_description'].some(k=>params.has(k)))return null;
 // Remove credentials from address/history before any network call, including failures.
 history.replaceState(null,'',location.pathname+location.search);
 if(params.has('error')||params.has('error_description'))throw Error('ログインリンクが無効か期限切れです。新しいリンクを送信してください。');
 if(!params.get('access_token')||!params.get('refresh_token'))throw Error('ログインリンクの情報が不足しています。新しいリンクを送信してください。');
 return {access_token:params.get('access_token'),refresh_token:params.get('refresh_token'),expires_at:Number(params.get('expires_at'))||undefined,expires_in:Number(params.get('expires_in'))||0};
}
export const RPCS={food:['get_food_context',{confirmed_only:false}],history:['get_meal_history',{page_size:100,page_offset:0}],hidaka:['get_hidaka_ai_context',{p_app_key:'hidaka-order',p_legacy_store_id:'hidaka-001',p_recent_limit:5}],shochu:['get_shochu_keep_navigation_reference',{p_include_finished:false}]};
export function validateConfig(c){
 if(c?.url?.replace(/\/$/,'')!==PROJECT)throw Error('接続先は既存の shochu-keep-ledger に限定しています。');
 const k=c.publishableKey||'';
 if(!/^sb_publishable_[\w-]+$/.test(k))throw Error('ブラウザー用のPublishable keyを設定してください。秘密キーは使用できません。');
 return {...c,url:PROJECT};
}
export class ReadOnlyClient{
 constructor(config,store,request=globalThis.fetch.bind(globalThis)){this.config=validateConfig(config);this.store=store;this.request=request;this.refreshing=null;this._navigationContext=null;}
 get navigationContext(){return this._navigationContext?.owner===this.session()?.user?.id?this._navigationContext:null;}
 session(){try{return JSON.parse(this.store.getItem(SESSION_KEY)||'null');}catch{return null;}}
 save(s){if(!s.access_token||!s.refresh_token||!s.user?.id)throw Error('ログイン情報の形式を確認できません。');const v={access_token:s.access_token,refresh_token:s.refresh_token,user:{id:s.user.id,email:s.user.email},expires_at:s.expires_at||Date.now()/1000+s.expires_in};if(!Number.isFinite(v.expires_at))throw Error('ログインの有効期限を確認できません。');this.store.setItem(SESSION_KEY,JSON.stringify(v));return v;}
 async send(path,body,token,method='POST'){
  const r=await this.request(this.config.url+path,{method,cache:'no-store',headers:{apikey:this.config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  if(!r.ok){const err=Error(r.status===429?'送信・アクセスが続いています。少し時間をおいて試してください。':r.status===401||r.status===403?'ログインまたは参照権限を確認してください。':`処理できませんでした（HTTP ${r.status}）。`);err.status=r.status;throw err;}return r.status===204?null:r.json();
 }
 async sendMagicLink(email,href){const normalizedEmail=String(email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))throw Error('メールアドレスを入力してください。');const redirectTo=authRedirectUrl(href);await this.send('/auth/v1/otp?redirect_to='+encodeURIComponent(redirectTo),{email:normalizedEmail,create_user:false});return redirectTo;}
 async otpRequest(path,body){
  let r;try{r=await this.request(this.config.url+path,{method:'POST',cache:'no-store',headers:{apikey:this.config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw new OtpAuthError('通信に失敗しました。接続を確認してもう一度お試しください。');}
  if(!r.ok){let code;try{code=(await r.json()).error_code;}catch{}
   const message=r.status===429?'短時間に送信回数が多いため、少し待ってから再度お試しください。':code==='otp_expired'?'認証コードが無効か、有効期限が切れています。時間をおいて再送してください。':path.endsWith('/verify')?'認証コードが正しくありません。':'認証コードを送信できませんでした。時間をおいてお試しください。';
   const error=new OtpAuthError(message);error.status=r.status;throw error;
  }
  try{return await r.json();}catch{throw new OtpAuthError('認証結果を確認できませんでした。もう一度お試しください。');}
 }
 async sendEmailOtp(email){const normalized=String(email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new OtpAuthError('メールアドレスを入力してください。');await this.otpRequest('/auth/v1/otp',{email:normalized,create_user:false});}
 async verifyOtp(email,token){const code=String(token||'').trim();if(!/^\d{6,10}$/.test(code))throw new OtpAuthError('認証コードが正しくありません。');
  const session=await this.otpRequest('/auth/v1/verify',{email:String(email).trim(),token:code,type:'email'});
  if(session?.user?.is_anonymous!==false||session?.user?.role!=='authenticated')throw new OtpAuthError('本人のログイン情報を確認できませんでした。');
  try{return this.save(session);}catch{throw new OtpAuthError('ログイン情報を保存できませんでした。ブラウザーの保存設定を確認してください。');}
 }
 async acceptRedirect(tokens){const user=await this.send('/auth/v1/user',undefined,tokens.access_token,'GET');return this.save({...tokens,user});}
 async fresh(){const current=this.session();if(!current)throw Error('先にログインしてください。');if(current.expires_at>Date.now()/1000+60)return current;
  if(!this.refreshing){const renew=async()=>{const s=this.session();if(!s)throw Error('ログアウトしています。');if(s.expires_at>Date.now()/1000+60)return s;try{const next=await this.send('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token});if(this.session()?.refresh_token!==s.refresh_token)throw Error('ログイン状態が変わりました。再度お試しください。');return this.save(next);}catch(e){if((e.status===400||e.status===401)&&this.session()?.refresh_token===s.refresh_token)this.store.removeItem(SESSION_KEY);throw e;}};
  this.refreshing=(globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('haraken-navi-refresh',renew):renew()).finally(()=>this.refreshing=null);}
  return this.refreshing;
 }
 async user(){const s=await this.fresh();return this.send('/auth/v1/user',undefined,s.access_token,'GET');}
 async logout(){this._navigationContext=null;const s=this.session();this.store.removeItem(SESSION_KEY);if(s)await this.send('/auth/v1/logout?scope=local',undefined,s.access_token);}
 async rpc(name,args,expectedOwner=null){if(!Object.values(RPCS).some(([n])=>n===name))throw Error('読み取り専用RPC以外は呼べません。');const s=await this.fresh();if(expectedOwner&&s.user.id!==expectedOwner)throw Error('ログイン状態が変わりました。');const data=await this.send('/rest/v1/rpc/'+name,args,s.access_token);if(expectedOwner&&(this.session()?.user?.id!==expectedOwner||!ownerSafe(data,expectedOwner)))throw Error('本人の参照結果を確認できません。');if(['get_food_context','get_meal_history','get_hidaka_ai_context'].includes(name)&&data?.schema_version!==1)throw Error('未対応の食事データ形式です。');return data;}
 async context(){const owner=this.session()?.user?.id;if(!owner){this._navigationContext=null;throw Error('先にログインしてください。');}const entries=Object.entries(RPCS);const values=await Promise.allSettled(entries.map(([,v])=>this.rpc(...v,owner)));if(this.session()?.user?.id!==owner){this._navigationContext=null;throw Error('ログイン状態が変わりました。');}const cloud=Object.fromEntries(entries.map(([key],i)=>[key,values[i].status==='fulfilled'?{data:values[i].value,ok:true,...(key==='hidaka'?{context:hidakaContext(values[i].value)}:{})}:{ok:false,error:key==='hidaka'?'日高オーダー履歴を取得できなかったため、今回は他の条件だけで判断します。 '+values[i].reason.message:values[i].reason.message}]));this._navigationContext=navigationContext(cloud,owner);return cloud;}
}


