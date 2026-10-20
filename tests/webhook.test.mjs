import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';

async function fixture({payment={},record={},environment='sandbox'}={}) {
  let handler; const writes=[], lookups=[];
  const row={id:'row',external_reference:'ref',amount_expected:180,currency:'MXN',plan:'bronce',status:'approved',provider_payment_id:'123',metadata:{environment},...record};
  const provider={id:123,external_reference:'ref',collector_id:3546561536,transaction_amount:180,currency_id:'MXN',status:'approved',metadata:{project:'tehilim-beyajad',plan:'bronce'},...payment};
  const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'admin-test',MERCADO_PAGO_ACCESS_TOKEN:'fake',MERCADO_PAGO_WEBHOOK_SECRET:'signature-test',MERCADO_PAGO_ENVIRONMENT:environment,MERCADO_PAGO_COLLECTOR_ID:'3546561536'};
  const db={from(table){let filters={};const q={insert(data){writes.push({table,data,action:'insert'});return q;},update(data){writes.push({table,data,action:'update'});return q;},select(){return q;},eq(k,v){filters[k]=v;return q;},single:async()=>({data:{id:'event'},error:null}),maybeSingle:async()=>({data:filters.external_reference?(filters.external_reference==='ref'?row:null):{id:'row'},error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;}};
  const source=await readFile('supabase/functions/mercadopago-webhook/index.ts','utf8');
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^\s*import .*;\n/,'')),{Deno:{env:{get:k=>env[k]},serve:f=>handler=f},createClient:()=>db,crypto,TextEncoder,Request,Response,URL,console:{log(){},error(){}},fetch:async url=>{lookups.push(url);return new Response(JSON.stringify(provider));}});
  const request=(valid=true)=>{const ts='1792499000';const signature=createHmac('sha256','signature-test').update(`id:123;request-id:request;ts:${ts};`).digest('hex');return new Request('https://example.test?data.id=123&type=payment',{method:'POST',headers:{'x-request-id':'request','x-signature':`ts=${ts},v1=${valid?signature:'invalid'}`},body:JSON.stringify({type:'payment',data:{id:'123'}})});};
  return {handler,request,writes,lookups};
}
test('Invalid HMAC rejected before provider lookup or database writes',async()=>{const f=await fixture();assert.equal((await f.handler(f.request(false))).status,401);assert.equal(f.writes.length,0);assert.equal(f.lookups.length,0);});
for(const [name,payment,record] of [
 ['amount',{transaction_amount:1},{}],['currency',{currency_id:'USD'},{}],['seller',{collector_id:7},{}],['reference',{external_reference:'other'},{}],['project',{metadata:{project:'other'}},{}],['duplicate payment',{}, {provider_payment_id:'999'}],['invalid expected amount',{}, {amount_expected:'invalid'}]
]) test(`Reject ${name} without modifying an approved payment`,async()=>{const f=await fixture({payment,record});const result=await (await f.handler(f.request())).json();assert.equal(result.processed,false);assert.equal(f.writes.filter(w=>w.table==='mercadopago_payments').length,0);});
for(const status of ['approved','pending','rejected','refunded','charged_back']) test(`Verified provider status ${status} is persisted`,async()=>{const f=await fixture({payment:{status}});const result=await (await f.handler(f.request())).json();assert.equal(result.processed,true);assert.equal(f.writes.find(w=>w.table==='mercadopago_payments').data.status,status);});
test('Production refuses a non-live payment',async()=>{const f=await fixture({environment:'production',payment:{live_mode:false}});assert.equal((await (await f.handler(f.request())).json()).processed,false);assert.equal(f.writes.filter(w=>w.table==='mercadopago_payments').length,0);});
test('Diagnostic rejects anon and ordinary user tokens before privileged access',async()=>{let handler;const source=await readFile('supabase/functions/diagnose-mercadopago/index.ts','utf8');vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/,'')),{Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'admin-test':undefined},serve:f=>handler=f},Response,createClient:()=>{throw Error('must not query database');}});for(const token of ['','anon-test','user-test']) assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`}}))).status,403);});
