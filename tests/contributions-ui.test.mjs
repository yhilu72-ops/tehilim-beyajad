import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const source=await readFile('assets/contributions.js','utf8');
const reference='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const goodCheckout={provider:'stripe',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_test_ui',externalReference:reference,amount:180,currency:'MXN',environment:'sandbox'};
function setup({native=false,response=goodCheckout,search='',stored={},deferred=false,statusCode=200}={}){
 const {document}=parseHTML('<html><body><p id="generalMercadoPagoStatus"></p><p id="donationStatus"></p><p id="tbjPaymentStatus"></p><button id="tbjCheckPayment"></button></body></html>');
 const store=new Map(Object.entries(stored)),calls=[],redirects=[],listeners={};let authListener,release;
 const c={document,Capacitor:{isNativePlatform:()=>native},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  location:{search,hash:'#donativos',assign:u=>redirects.push(u)},URL,URLSearchParams,crypto,confirm:()=>true,
  setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>listeners[name]=fn,
  sb:{auth:{getUser:async()=>({data:{user:{id:'user-a'}}}),getSession:async()=>({data:{session:{access_token:'fake'}}}),onAuthStateChange:fn=>authListener=fn}},
  SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',
  fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(deferred)await new Promise(r=>release=r);return new Response(JSON.stringify(response),{status:statusCode});}};
 c.window=c;vm.runInNewContext(source,c);
 return {c,document,store,calls,redirects,auth:(...args)=>authListener(...args),release:()=>release?.(),start:()=>c.startGeneralContribution('bronce')};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('UI sends the displayed MXN price and redirects only to Stripe',async()=>{
 const x=setup();await x.start();assert.equal(x.redirects.length,1);assert.match(x.calls[0].url,/create-stripe-checkout$/);
 assert.equal(x.calls[0].body.amount,180);assert.equal(x.calls[0].body.currency,'MXN');assert.equal(x.calls[0].body.platform,'web');
 assert.equal(JSON.parse(x.store.get('tbj_pending_payment')).provider,'stripe');
});
test('Double taps create one client request; retry persists the same UUID',async()=>{
 const x=setup({deferred:true});const first=x.start();await tick();await x.start();assert.equal(x.calls.length,1);
 const key=x.calls[0].body.requestId;x.release();await first;const second=x.start();await tick();x.release();await second;
 assert.equal(x.calls[1].body.requestId,key);
});
test('Native builds cannot open external contribution checkout',async()=>{
 const x=setup({native:true});await x.start();assert.equal(x.calls.length,0);assert.equal(x.redirects.length,0);
 assert.match(x.document.getElementById('generalMercadoPagoStatus').textContent,/versión móvil/);
});
test('Mismatched totals, currency and untrusted destinations are blocked in the UI',async()=>{
 for(const patch of [{amount:1},{currency:'USD'},{checkoutUrl:'https://evil.test/pay'}]){
  const x=setup({response:{...goodCheckout,...patch}});await x.start();assert.equal(x.redirects.length,0);
 }
});
test('Sign out while checkout is loading prevents redirect or restoring pending identity',async()=>{
 const x=setup({deferred:true});const first=x.start();await tick();x.auth('SIGNED_OUT',null);x.release();await first;
 assert.equal(x.redirects.length,0);assert.equal(x.store.has('tbj_pending_payment'),false);
});
test('A forged success query still asks the server and never shows thanks for pending status',async()=>{
 const x=setup({search:'?provider=stripe&reference='+reference+'&status=approved',response:{status:'pending',environment:'production'}});
 await tick();assert.match(x.calls[0].url,/stripe-payment-status$/);
 const text=x.document.getElementById('tbjPaymentStatus').textContent;assert.match(text,/pendiente/);assert.doesNotMatch(text,/Gracias|confirmado/);
});
test('Sandbox success and partial refunds use accurate non-success copy',async()=>{
 for(const [response,pattern]of [[{status:'approved',environment:'sandbox'},/PRUEBA confirmada/],[{status:'partially_refunded',environment:'production'},/reembolso parcial/]]){
  const x=setup({search:'?provider=stripe&reference='+reference,response});await tick();
  assert.match(x.document.getElementById('tbjPaymentStatus').textContent,pattern);
  assert.doesNotMatch(x.document.getElementById('tbjPaymentStatus').textContent,/Gracias/);
 }
});
test('Historical Mercado Pago return links continue to resolve through the legacy status endpoint',async()=>{
 const x=setup({search:'?reference='+reference,response:{status:'pending',environment:'sandbox'}});await tick();
 assert.match(x.calls[0].url,/\/payment-status$/);assert.doesNotMatch(x.calls[0].url,/stripe-payment/);
});
test('Disabled server explains availability without opening a checkout',async()=>{
 const x=setup({response:{error:'Estamos terminando de habilitar las aportaciones.',code:'PAYMENTS_NOT_ENABLED'},statusCode:503});
 await x.start();assert.equal(x.redirects.length,0);assert.match(x.document.getElementById('generalMercadoPagoStatus').textContent,/habilitar/);
});
