import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile('assets/kabalot.js','utf8');
function setup({error=null,rows=[],signedIn=true,read=null}={}){
 const nodes=new Map(),writes=[];let localWrites=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',innerHTML:'',className:''});return nodes.get(id);};
 const sb={auth:{getUser:async()=>({data:{user:signedIn?{id:'user-a'}:null}})},from(table){let op='read',payload;
  const q={insert(v){op='insert';payload=v;writes.push({table,payload:v});return q;},select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},single(){return Promise.resolve({data:error?null:{id:'saved-id'},error});},then(resolve,reject){return Promise.resolve(read?read():{data:rows,error,count:0}).then(resolve,reject);}};return q;}};
 const ctx={sb,selectedRealRoom:{id:'room-a'},document:{getElementById:node,querySelector:s=>s.startsWith('input[')?{value:'joinable'}:null,querySelectorAll:()=>[]},localStorage:{getItem:()=>JSON.stringify([{id:'unpublished',text:'LOCAL FAKE'}]),setItem:()=>localWrites++},addEventListener:()=>{},setTimeout:()=>{},location:{hash:'#kabalot_v58'},alert:()=>{},confirm:()=>true};ctx.window=ctx;vm.runInNewContext(code,ctx);
 node('kabalaTextV58').value='Compromiso';node('kabalaNameV58').value='Private name';
 return {ctx,node,writes,localWrites:()=>localWrites};
}
test('Publishing sends only real schema fields, protects anonymity, and ignores simultaneous taps',async()=>{
 const x=setup();x.node('kabalaAnonV58').checked=true;
 await Promise.all([x.ctx.publishKabalaV58(),x.ctx.publishKabalaV58()]);
 assert.equal(x.writes.length,1);const payload=x.writes[0].payload;
 assert.equal(payload.local_id,undefined);assert.equal(payload.user_id,'user-a');assert.equal(payload.display_name,'Anónimo');assert.equal(payload.joinable,true);
 assert.match(x.node('kabalaStatusV58').textContent,/publicada/);assert.equal(x.node('kabalaTextV58').value,'');
});
test('Failed publication keeps the draft and never reports a local copy as published',async()=>{
 const x=setup({error:{message:'offline'}});await x.ctx.publishKabalaV58();
 assert.match(x.node('kabalaStatusV58').textContent,/No se pudo publicar/);assert.equal(x.node('kabalaTextV58').value,'Compromiso');assert.equal(x.localWrites(),0);
});
test('Signed-out users cannot publish a fake commitment',async()=>{
 const x=setup({signedIn:false});await x.ctx.publishKabalaV58();assert.equal(x.writes.length,0);assert.match(x.node('kabalaStatusV58').textContent,/inicia sesión/);
});
test('Published list never imports historical unsent local items',async()=>{
 const x=setup();await x.ctx.loadKabalotV58();assert.equal(x.ctx.kabalotItemsV58.length,0);assert.doesNotMatch(x.node('kabalotListV58').innerHTML,/LOCAL FAKE/);
});
test('A delayed response from the previous room is not displayed',async()=>{
 let finish;const x=setup({read:()=>new Promise(resolve=>finish=resolve)});const pending=x.ctx.loadKabalotV58();
 await new Promise(resolve=>setImmediate(resolve));x.ctx.selectedRealRoom={id:'room-b'};
 finish({data:[{id:'old-room',text:'PRIVATE OLD ROOM'}]});await pending;
 assert.doesNotMatch(x.node('kabalotListV58').innerHTML,/PRIVATE OLD ROOM/);assert.equal(x.ctx.kabalotItemsV58.length,0);
});
test('An omitted public wish name never publishes the account email',async()=>{
 const html=await readFile('index.html','utf8');const start=html.indexOf('async function publishWish(){');const end=html.indexOf('window.addEventListener("hashchange"',start);
 const nodes={wishTextInput:{value:'Un buen deseo'},wishNameInput:{value:''},wishAnonymousInput:{checked:false}};let payload;
 const ctx={selectedRealRoom:{id:'room-a'},document:{getElementById:id=>nodes[id]},setWishStatus:()=>{},loadWishesForSelectedRoom:()=>{},sb:{auth:{getUser:async()=>({data:{user:{id:'a',email:'private@example.invalid'}}})},from:()=>({upsert:async()=>({}),insert:async value=>{payload=value;return {};}})}};ctx.window=ctx;
 vm.runInNewContext(html.slice(start,end),ctx);await ctx.publishWish();assert.equal(payload.display_name,'Participante');assert.doesNotMatch(JSON.stringify(payload),/private@example/);
});
