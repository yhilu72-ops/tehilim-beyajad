import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {ACCOUNTS, SITE, validateInput, checkoutParameters, snapshot, PaymentError} from '../supabase/functions/_shared/stripe-core.ts';
import {createCheckoutHandler, createStatusHandler, createWebhookHandler} from '../supabase/functions/_shared/stripe-handlers.ts';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const requestId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderBase=()=>({id,user_id:uid,account_id:ACCOUNTS.test,livemode:false,plan:'bronce',amount:18000,currency:'mxn',
  status:'creating',locale:'es',checkout_expires_at:Math.floor(Date.now()/1000)+3600,request_id:requestId,amount_refunded:0});
const sessionBase=()=>({id:'cs_test_testrun',object:'checkout.session',livemode:false,mode:'payment',status:'open',
  payment_status:'unpaid',client_reference_id:id,metadata:{order_id:id,integration:'tehilim_contributions_v1'},
  currency:'mxn',amount_total:18000,url:'https://checkout.stripe.com/c/pay/cs_test_testrun',payment_intent:null});
const paidSession=()=>({...sessionBase(),status:'complete',payment_status:'paid',payment_intent:{
  id:'pi_test',object:'payment_intent',amount:18000,amount_received:18000,currency:'mxn',livemode:false,status:'succeeded',metadata:{order_id:id},
  latest_charge:{id:'ch_test',amount:18000,currency:'mxn',livemode:false,payment_intent:'pi_test',paid:true,amount_refunded:0,disputed:false}}});
const req=(data,headers={})=>new Request(SITE,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json',...headers},body:JSON.stringify(data)});
function setup(options={}) {
  const order={...orderBase(),...options.order};let session=options.session||sessionBase();
  const calls={create:[],apply:[],reserve:[],attach:[]};const sdk=new Stripe('sk_test_placeholder');
  const stripe={accounts:{retrieve:async()=>options.account||{id:ACCOUNTS.test,charges_enabled:true}},
    checkout:{sessions:{create:async(p,o)=>{calls.create.push({p,o});return session;},retrieve:async()=>session}},
    paymentIntents:{retrieve:async()=>({metadata:{order_id:id}})},
    charges:{retrieve:async()=>({payment_intent:'pi_test'})},
    disputes:{list:async()=>({data:options.disputes||[],has_more:false})},webhooks:sdk.webhooks};
  const services={authenticate:async()=>{if(options.auth===false)throw new PaymentError('Inicia sesión',401);return {id:uid,is_anonymous:!!options.anonymous};},
    settings:async()=>({checkout_enabled:options.enabled!==false,livemode:false}),
    provider:()=>({stripe,accountId:ACCOUNTS.test,webhookSecret:options.noSecret?undefined:'whsec_unit_test'}),
    reserve:async(user,live,input)=>{calls.reserve.push({user,live,input});return order;},
    attach:async(...args)=>{calls.attach.push(args);order.session_id=args[1];},
    find:async()=>options.unknown?null:order,
    findOwned:async(reference,user)=>options.foreign?null:(reference===id&&user===uid?order:null),
    apply:async(o,e,s)=>{calls.apply.push({o,e,s});return {status:s.status};}};
  return {services,calls,order,stripe,setSession:s=>session=s,checkout:createCheckoutHandler(services),status:createStatusHandler(services),webhook:createWebhookHandler(services)};
}
function eventRequest(x,event={},override={}) {
  const payload=JSON.stringify({id:'evt_signed_test',object:'event',created:Math.floor(Date.now()/1000),livemode:false,
    type:'checkout.session.completed',data:{object:paidSession()},...event});
  const signature=x.stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_unit_test',timestamp:override.timestamp});
  return new Request(SITE+'/stripe-webhook?mode='+(override.mode||'test'),{method:'POST',headers:{'stripe-signature':signature},body:override.body||payload});
}
test('Stripe catalog fixes all four MXN amounts and rejects changed price/currency',()=>{
  for(const [plan,amount]of Object.entries({bronce:18000,plata:36000,oro:72000,diamante:180000}))assert.equal(validateInput({plan,requestId}).amount,amount);
  assert.throws(()=>validateInput({plan:'bronce',requestId,amount:1}),/importe/);
  assert.throws(()=>validateInput({plan:'bronce',requestId,currency:'USD'}),/importe/);
  assert.throws(()=>validateInput({plan:'__proto__',requestId}));
});
test('Stripe anonymous dedication erases the name and limits user text',()=>{
  const v=validateInput({plan:'bronce',requestId,anonymous:true,donorName:'PRIVATE',message:'x'.repeat(600)});
  assert.equal(v.donor_name,'');assert.equal(v.message.length,500);
  assert.throws(()=>validateInput({plan:'bronce',requestId,anonymous:'false'}));
});
test('Checkout has dynamic methods, exact MXN, stable return origin and no personal metadata',()=>{
  const p=checkoutParameters(orderBase());assert.equal(p.line_items[0].price_data.unit_amount,18000);
  assert.equal(p.ui_mode,'hosted_page');
  assert.equal(p.line_items[0].price_data.currency,'mxn');assert.equal(p.payment_method_types,undefined);
  assert.equal(p.adaptive_pricing.enabled,false);assert.equal(p.automatic_tax.enabled,false);
  assert.equal(p.phone_number_collection.enabled,false);assert.equal(p.customer_email,undefined);
  assert.equal(new URL(p.success_url).origin,SITE);assert.deepEqual(Object.keys(p.metadata).sort(),['integration','order_id']);
});
test('Stripe checkout rejects missing auth, anonymous accounts and native platforms',async()=>{
  for(const options of [{auth:false},{anonymous:true}]){const x=setup(options);assert.equal((await x.checkout(req({plan:'bronce',requestId}))).status,options.auth===false?401:403);assert.equal(x.calls.create.length,0);}
  const x=setup();assert.equal((await x.checkout(req({plan:'bronce',requestId,platform:'ios'}))).status,403);
  assert.equal((await x.checkout(req({plan:'bronce',requestId},{Origin:'capacitor://localhost'}))).status,403);
});
test('Disabled checkout, missing signing secret and wrong merchant cannot create a session',async()=>{
  for(const options of [{enabled:false},{noSecret:true},{account:{id:'acct_other',charges_enabled:true}},{account:{id:ACCOUNTS.test,charges_enabled:false}}]){
    const x=setup(options);assert.equal((await x.checkout(req({plan:'bronce',requestId}))).status,503);assert.equal(x.calls.create.length,0);
  }
});
test('Retries reuse the stored Stripe session and persistent idempotency key',async()=>{
  const x=setup();const a=await x.checkout(req({plan:'bronce',requestId})),b=await x.checkout(req({plan:'bronce',requestId}));
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(x.calls.create.length,1);
  assert.equal(x.calls.create[0].o.idempotencyKey,'tbj:'+id);assert.equal((await a.json()).amount,180);
});
test('Unknown stale attempts never create a second session after idempotency expiry',async()=>{
  const x=setup({order:{checkout_expires_at:1}});const r=await x.checkout(req({plan:'bronce',requestId}));
  assert.equal(r.status,409);assert.equal(x.calls.create.length,0);
});
test('An approved, processing or refunded order cannot reopen checkout',async()=>{
  for(const status of ['approved','processing','refunded','partially_refunded','disputed','charged_back']){
    const x=setup({order:{status}});assert.equal((await x.checkout(req({plan:'bronce',requestId}))).status,409);assert.equal(x.calls.create.length,0);
  }
});
test('Provider amount/mode/reference mismatches and unsafe URLs never redirect',async()=>{
  for(const patch of [{amount_total:1},{currency:'usd'},{livemode:true},{client_reference_id:requestId},{url:'https://evil.test/checkout'}]){
    const x=setup({session:{...sessionBase(),...patch}});assert.notEqual((await x.checkout(req({plan:'bronce',requestId}))).status,200);
  }
});
test('Payment status only returns own minimal information and never fulfills',async()=>{
  const x=setup();const r=await x.status(req({reference:id}));assert.equal(r.status,200);
  assert.equal((await r.json()).amount,180);assert.equal(x.calls.apply.length,0);
  assert.equal((await setup({foreign:true}).status(req({reference:id}))).status,404);
  assert.equal((await setup({auth:false}).status(req({reference:id}))).status,401);
});
test('Webhook verifies actual Stripe SDK HMAC and applies a confirmed API snapshot',async()=>{
  const x=setup({session:paidSession()});assert.equal((await x.webhook(eventRequest(x))).status,200);
  assert.equal(x.calls.apply.length,1);assert.equal(x.calls.apply[0].s.status,'approved');
});
test('Tampered, expired and missing signatures never reach the database',async()=>{
  const x=setup({session:paidSession()});
  for(const request of [eventRequest(x,{}, {body:'{}'}),eventRequest(x,{}, {timestamp:1}),new Request(SITE+'?mode=test',{method:'POST',body:'{}'})])
    assert.equal((await x.webhook(request)).status,400);
  assert.equal(x.calls.apply.length,0);
});
test('Cross-account and cross-mode events are rejected even with a valid signature',async()=>{
  const x=setup({session:paidSession()});
  assert.equal((await x.webhook(eventRequest(x,{account:'acct_other'}))).status,400);
  assert.equal((await x.webhook(eventRequest(x,{livemode:true}))).status,400);
  assert.equal(x.calls.apply.length,0);
});
test('Paid redirect or webhook payload cannot approve an unpaid API session',async()=>{
  const x=setup();assert.equal((await x.webhook(eventRequest(x))).status,200);assert.equal(x.calls.apply[0].s.status,'pending');
});
test('Async payment remains processing until the authoritative intent succeeds',async()=>{
  const session=paidSession();session.payment_status='unpaid';session.payment_intent.status='processing';
  const x=setup({session});await x.webhook(eventRequest(x));assert.equal(x.calls.apply[0].s.status,'processing');
  x.setSession(paidSession());await x.webhook(eventRequest(x,{type:'checkout.session.async_payment_succeeded'}));
  assert.equal(x.calls.apply[1].s.status,'approved');
});
test('A failed card attempt is rejected without approving the order',async()=>{
  const session=paidSession();session.payment_status='unpaid';session.payment_intent.status='requires_payment_method';session.payment_intent.last_payment_error={code:'card_declined'};
  assert.equal(snapshot(orderBase(),session,ACCOUNTS.test).status,'rejected');
});
test('Full and partial refunds are derived from charge totals, not event claims',async()=>{
  for(const [amount,status]of [[18000,'refunded'],[9000,'partially_refunded']]){
    const session=paidSession();session.payment_intent.latest_charge.amount_refunded=amount;
    const x=setup({session,order:{session_id:'cs_test_testrun'}});await x.webhook(eventRequest(x,{type:'charge.refunded',data:{object:{object:'charge',payment_intent:'pi_test'}}}));
    assert.equal(x.calls.apply[0].s.status,status);assert.equal(x.calls.apply[0].s.amount_refunded,amount);
  }
});
test('Dispute losses stay charged back; won disputes can restore a settled payment',async()=>{
  for(const [dispute,status]of [['lost','charged_back'],['won','approved'],['needs_response','disputed']]){
    const session=paidSession();session.payment_intent.latest_charge.disputed=true;
    const x=setup({session,disputes:[{status:dispute}]});await x.webhook(eventRequest(x,{type:'charge.dispute.closed'}));
    assert.equal(x.calls.apply[0].s.status,status);
  }
});
test('Unknown orders are acknowledged but never published',async()=>{
  const x=setup({unknown:true});assert.equal((await x.webhook(eventRequest(x))).status,200);assert.equal(x.calls.apply.length,0);
});
test('A failed database write returns retryable error, not false webhook success',async()=>{
  const x=setup({session:paidSession()});x.services.apply=async()=>{throw Error('database unavailable');};
  assert.equal((await x.webhook(eventRequest(x))).status,503);
});
test('Settled amount, intent metadata and charge identity are checked independently',()=>{
  for(const alter of [s=>s.payment_intent.amount_received=1,s=>s.payment_intent.metadata.order_id=requestId,
    s=>s.payment_intent.latest_charge.payment_intent='pi_other',s=>s.payment_intent.latest_charge.paid=false]){
    const s=paidSession();alter(s);assert.throws(()=>snapshot(orderBase(),s,ACCOUNTS.test));
  }
});
