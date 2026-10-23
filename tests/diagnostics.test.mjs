import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

async function setup({ownerId='3546561536',testUser=true,site='MLM',webhook=true,ownerStatus=200,ownerError=null,providerToken='provider-test-secret',adminKeys='{"default":"sb_secret_test_only"}',legacyAdmin='admin-test-secret'}={}) {
  let handler; const requests=[];
  const env={SUPABASE_SERVICE_ROLE_KEY:legacyAdmin,SUPABASE_SECRET_KEYS:adminKeys,SUPABASE_URL:'https://example.supabase.co',MERCADO_PAGO_ACCESS_TOKEN:providerToken,MERCADO_PAGO_WEBHOOK_SECRET:webhook?'signature-test-secret':undefined};
  const source=await readFile('supabase/functions/diagnose-mercadopago/index.ts','utf8');
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/,'')),{
    Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},Response,URLSearchParams,AbortSignal,console,Date,
    createClient:()=>{throw Error('Configuration diagnostics must not query the database');},
    fetch:async (url,options)=>{
      requests.push({url,options});assert.equal(options.method??'GET','GET');
      return new Response(JSON.stringify(url.endsWith('/users/me') && ownerError ? ownerError : url.includes('/applications/')?{id:123,name:'Test application',owner_id:ownerId}:
        {id:ownerId,site_id:site,tags:testUser?['test_user']:[],email:'private@example.test',password:'private-password',address:{street_name:'private-address'}}),
        {status:url.endsWith('/users/me')?ownerStatus:200});
    },
  });
  const request=(authorization='',apikey='')=>new Request('https://example.test',{method:'POST',headers:{Authorization:authorization,apikey,'Content-Type':'application/json'},body:JSON.stringify({mode:'configuration'})});
  return {handler,requests,request};
}

test('Administrative Bearer token reaches read-only configuration diagnostics',async()=>{
  const x=await setup();const response=await x.handler(x.request('Bearer admin-test-secret'));
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.readyForCheckoutTest,true);
  assert.equal(data.checks.collectorMatches,true);assert.equal(x.requests.length,4);
  const text=JSON.stringify(data);for(const secret of ['admin-test-secret','provider-test-secret','signature-test-secret','private@example.test','private-password','private-address'])assert.equal(text.includes(secret),false);
});

test('Provider policy denial is classified without leaking arbitrary error content',async()=>{
  const x=await setup({ownerStatus:403,ownerError:{code:'PA_UNAUTHORIZED',message:'Policy denied provider-test-secret private@example.test'}});
  const data=await(await x.handler(x.request('Bearer admin-test-secret'))).json();
  assert.equal(data.identityChecks.tokenOwner.reason,'provider_policy_denied');
  assert.equal(data.readyForCheckoutTest,false);
  assert.equal(JSON.stringify(data).includes('provider-test-secret'),false);
  assert.equal(JSON.stringify(data).includes('private@example.test'),false);
});

test('Credential shape hints are redacted and never substitute for provider verification',async()=>{
  for(const [providerToken,publicKey,structure] of [
    ['APP_USR-00000000-0000-0000-0000-000000000000',true,false],
    ['APP_USR-123-456-synthetic-789',false,true],
    ['synthetic-incomplete',false,false],
  ]) {
    const x=await setup({providerToken,ownerStatus:403});
    const data=await(await x.handler(x.request('Bearer admin-test-secret'))).json();
    assert.equal(data.configuration.credentialFormat.looksLikePublicKey,publicKey);
    assert.equal(data.configuration.credentialFormat.hasRecognizedTokenStructure,structure);
    assert.equal(data.readyForCheckoutTest,false);
    assert.equal(JSON.stringify(data).includes(providerToken),false);
  }
});
test('Current administrative secret key works without a legacy JWT',async()=>{
  const x=await setup({legacyAdmin:null});const r=await x.handler(x.request('','sb_secret_test_only'));
  assert.equal(r.status,200);assert.equal((await r.text()).includes('sb_secret_test_only'),false);
});
test('Public, unrelated and malformed key configurations do not grant administrative access',async()=>{
  for(const adminKeys of ['{}','broken','null','[]','{"default":""}','{"default":null}']){
    const x=await setup({adminKeys});for(const key of ['','sb_publishable_fake','sb_secret_test_only'])assert.equal((await x.handler(x.request('',key))).status,403);
    assert.equal(x.requests.length,0);
  }
  const x=await setup();for(const key of ['sb_publishable_fake','sb_secret_other_project'])assert.equal((await x.handler(x.request('',key))).status,403);
  assert.equal(x.requests.length,0);
});
test('Diagnostic denies anon, ordinary, bare and malformed tokens before provider access',async()=>{
  const x=await setup();for(const header of ['','Bearer anon-test','Bearer user-test','admin-test-secret','Beareradmin-test-secret','Bearer admin-test-secret trailing']){
    assert.equal((await x.handler(x.request(header))).status,403);
  }assert.equal(x.requests.length,0);
});
test('Diagnostic accepts the standard case-insensitive Bearer scheme',async()=>{
  const x=await setup();assert.equal((await x.handler(x.request('bearer admin-test-secret'))).status,200);
});
test('Diagnostic detects the real-account and mismatched-collector sandbox block',async()=>{
  const x=await setup({ownerId:'another-owner',testUser:false});const data=await(await x.handler(x.request('Bearer admin-test-secret'))).json();
  assert.equal(data.readyForCheckoutTest,false);assert.equal(data.checks.collectorMatches,false);assert.equal(data.checks.accountMatchesEnvironment,false);assert.equal(data.checks.mexicanAccount,true);
});
test('Diagnostic cannot declare readiness with missing webhook secret or wrong country',async()=>{
  for(const options of [{webhook:false},{site:'MLA'},{ownerStatus:401}]){
    const x=await setup(options);const data=await(await x.handler(x.request('Bearer admin-test-secret'))).json();assert.equal(data.readyForCheckoutTest,false);
  }
});
