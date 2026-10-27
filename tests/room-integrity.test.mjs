import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('assets/room-integrity.js','utf8');
function setup({query=async()=>({data:[],error:null}),auth=true}={}){
  const elements=new Map(),tables=[],filters=[];let onAuth;
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},replaceChildren(){this.innerHTML='';}});return elements.get(id);};
  const storage={activeRoomV54:'private room',tehilim_donations_old:'fake payment',tbj_font:'36'};
  Object.defineProperty(storage,'removeItem',{value:key=>delete storage[key]});
  const context=vm.createContext({document:{getElementById:element},location:{hash:'#menu'},localStorage:storage,addEventListener(){},sb:{auth:{getUser:async()=>({data:{user:auth?{id:'user-a'}:null}}),onAuthStateChange:fn=>{onAuth=fn;}},from(table){tables.push(table);const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return query();}};return q;}}});
  vm.runInContext('window=globalThis; let selectedRealRoom={id:"room-a"};',context);vm.runInContext(source,context);
  return {context,elements,tables,filters,storage,onAuth:(...args)=>onAuth(...args),refresh:()=>context.tbjRefreshContributions()};
}
test('Both historical active room references stay synchronized on join and leave',()=>{const x=setup();x.context.selectedRealRoom={id:'room-b'};assert.equal(vm.runInContext('selectedRealRoom.id',x.context),'room-b');vm.runInContext('selectedRealRoom=null',x.context);assert.equal(x.context.selectedRealRoom,null);});
test('All donation screens use only verified published contributions; anonymous names and markup are protected',async()=>{const x=setup({query:async()=>({data:[{plan:'oro',anonymous:true,donor_name:'Private Name',message:'<img src=x onerror=alert(1)>'}]})});await x.refresh();assert.deepEqual(x.tables,['room_verified_contributions']);assert.ok(x.filters.some(([k,v])=>k==='published'&&v===true));for(const id of ['tbjContributions','roomDonationsListV58','donationListV49']){const html=x.elements.get(id).innerHTML;assert.match(html,/Anónimo/);assert.doesNotMatch(html,/Private Name|<img/);assert.match(html,/&lt;img/);}});
test('Failed verification never falls back to local fake donations',async()=>{const x=setup({query:async()=>({error:new Error('network')})});await x.refresh();assert.match(x.elements.get('roomDonationsListV58').textContent,/No se pudieron verificar/);assert.equal(x.elements.get('latestDonationBannerV53').innerHTML,'');});
test('A late response cannot show the previous room contributions',async()=>{let finish;const x=setup({query:()=>new Promise(resolve=>finish=resolve)});const pending=x.refresh();await new Promise(resolve=>setImmediate(resolve));x.context.selectedRealRoom={id:'room-b'};finish({data:[{message:'PRIVATE ROOM A'}]});await pending;assert.doesNotMatch(x.elements.get('tbjContributions').innerHTML,/PRIVATE ROOM A/);});
test('Sign out clears private room restoration and prevents late donation results',async()=>{let finish;const x=setup({query:()=>new Promise(resolve=>finish=resolve)});const pending=x.refresh();await new Promise(resolve=>setImmediate(resolve));x.onAuth('SIGNED_OUT',null);finish({data:[{message:'PRIVATE'}]});await pending;assert.equal(x.context.selectedRealRoom,null);assert.equal(x.storage.activeRoomV54,undefined);assert.equal(x.storage.tehilim_donations_old,undefined);assert.equal(x.storage.tbj_font,'36');assert.doesNotMatch(x.elements.get('tbjContributions').innerHTML,/PRIVATE/);});
test('No authenticated account means no contributions query',async()=>{const x=setup({auth:false});await x.refresh();assert.equal(x.tables.length,0);assert.match(x.elements.get('tbjContributions').textContent,/Inicia sesión/);});
