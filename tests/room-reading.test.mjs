import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html = await readFile(new URL('../index.html', import.meta.url),'utf8');
const source = await readFile(new URL('../assets/room-reading.js', import.meta.url),'utf8');
const psalms = JSON.parse(await readFile(new URL('../tehilim.json', import.meta.url),'utf8'));
const tick = async () => { for(let i=0;i<20;i++) await new Promise(r=>setImmediate(r)); };
function setup({failSave=false, failText=false, auth=true, delayedList=false, storage=new Map()}={}) {
  const {document,window:dom}=parseHTML(html);
  // Linkedom deliberately omits the writable HTMLSelectElement.value setter.
  for(const select of document.querySelectorAll('select')) Object.defineProperty(select,'value',{get(){return this._value || this.querySelector('option')?.getAttribute('value') || '';},set(v){this._value=v;},configurable:true});
  const listeners=new Map(), calls=[], location={hash:'#mis_capitulos'};
  let onAuth, finishList;
  const rows=[{chapter_number:1,is_mine:true,status:'claimed'},{chapter_number:2,is_mine:true,status:'claimed'},{chapter_number:3,is_mine:false,status:'claimed'},{chapter_number:4,is_mine:true,status:'holding'}];
  const sb={auth:{getUser:async()=>({data:{user:auth?{id:'user-a'}:null}}),onAuthStateChange(fn){onAuth=fn;}},
    from(){const q={select(){return q;},eq(){return q;},single:async()=>({data:{current_round:1}})};return q;},
    async rpc(name,args){calls.push({name,args});if(name==='tbj_seat_list'){if(delayedList)return new Promise(resolve=>finishList=resolve);return {data:rows.map(r=>({...r}))};}
      if(failSave)return {error:new Error('Sin conexión')};
      const row=rows.find(r=>r.chapter_number===args.p_chapter_number&&r.is_mine);if(row)row.status='completed';
      return {data:{ok:!!row,chapter:args.p_chapter_number}};}, removeChannel(){}};
  const context=vm.createContext({document,location,console,Event:dom.Event,sb,selectedRealRoom:{id:'room-a'},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},setInterval(){},scrollTo(){},
    addEventListener(n,fn){if(!listeners.has(n))listeners.set(n,[]);listeners.get(n).push(fn);},
    dispatchEvent(e){for(const fn of listeners.get(e.type)||[])fn(e);},
    fetch:async()=>({ok:!failText,json:async()=>psalms})});
  vm.runInContext('window=globalThis;',context); vm.runInContext(source,context);
  const click=async selector=>{const b=document.querySelector(selector);assert.ok(b,selector);b.dispatchEvent(new dom.Event('click',{bubbles:true}));await tick();};
  const route=async hash=>{location.hash=hash;context.dispatchEvent(new dom.Event('hashchange'));await tick();};
  return {context,document,location,rows,calls,storage,click,route,refresh:async()=>{context.dispatchEvent(new dom.Event('focus'));await tick();},signOut:()=>onAuth('SIGNED_OUT'),finishList:data=>finishList({data})};
}
test('Room reading lists only own confirmed chapters and never treats a reservation as read',async()=>{
  const x=setup();await tick();const list=x.document.querySelector('#tbjMyReadingList');
  assert.ok(list.querySelector('[data-reading-item="1"]'));assert.ok(list.querySelector('[data-reading-item="2"]'));
  assert.equal(list.querySelector('[data-reading-item="3"]'),null);assert.equal(list.querySelector('[data-reading-item="4"]'),null);
  assert.equal(x.calls.filter(c=>c.name.includes('complete')).length,0);
});
test('Read in the app loads the exact bundled chapter and records only that chapter',async()=>{
  const x=setup();await tick();await x.click('[data-read-chapter="1"]');await x.route('#leer_sala');
  assert.ok(x.document.querySelector('#tbjRoomReaderText').textContent.includes(psalms.chapters[1].hebrew[0]));
  assert.equal(x.calls.filter(c=>c.name.includes('complete')).length,0);
  await x.click('#tbjRoomReaderComplete');
  const call=x.calls.find(c=>c.name==='tbj_seat_complete_chapter');
  assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{p_room_id:'room-a',p_round_number:1,p_chapter_number:1,p_read_mode:'normal'});
  assert.equal(x.rows[0].status,'completed');assert.equal(x.rows[1].status,'claimed');
  assert.match(x.document.querySelector('#tbjRoomReaderComplete').textContent,/registrada/);
  assert.equal(x.document.querySelector('#tbjRoomReaderNext').hidden,false);
  await x.click('#tbjRoomReaderNext');assert.match(x.document.querySelector('#tbjRoomReaderTitle').textContent,/2/);
});
test('Book now and later remain pending, survive reload, and refresh does not collapse an open choice',async()=>{
  const x=setup();await tick();await x.click('[data-book-chapter="2"]');await x.refresh();
  assert.equal(x.document.querySelector('#tbjBookChoice2').hidden,false);
  await x.click('[data-book-later="2"]');assert.equal(x.rows[1].status,'claimed');
  assert.equal(x.calls.filter(c=>c.name.includes('complete')).length,0);
  const y=setup({storage:x.storage});await tick();assert.match(y.document.querySelector('[data-reading-item="2"]').textContent,/Para leer después/);
  await y.click('[data-book-chapter="2"]');await y.click('[data-book-now="2"]');
  assert.equal(y.rows[1].status,'claimed');assert.match(y.document.querySelector('[data-reading-item="2"]').textContent,/Lectura en tu libro/);
});
test('A failed save remains pending and explains that nothing was recorded',async()=>{
  const x=setup({failSave:true});await tick();await x.click('[data-complete-chapter="1"]');
  assert.equal(x.rows[0].status,'claimed');assert.match(x.document.querySelector('#tbjMyReadingStatus').textContent,/No se guardó/);
  assert.equal(x.document.querySelector('[data-complete-chapter="1"]').disabled,false);
});
test('Unavailable text cannot leave an enabled reader completion button',async()=>{
  const x=setup({failText:true});await tick();await x.click('[data-read-chapter="1"]');await x.route('#leer_sala');
  assert.equal(x.document.querySelector('#tbjRoomReaderComplete').disabled,true);
  assert.match(x.document.querySelector('#tbjRoomReaderText').textContent,/No pudimos cargar/);
});
test('Late results after changing rooms or signing out cannot disclose old private chapter state',async()=>{
  const x=setup({delayedList:true});await tick();x.context.selectedRealRoom={id:'room-b'};
  x.finishList(x.rows);await tick();assert.equal(x.document.querySelector('[data-reading-item]'),null);
  const y=setup({delayedList:true});await tick();y.signOut();y.finishList(y.rows);await tick();
  assert.equal(y.document.querySelector('[data-reading-item]'),null);
});
test('Unauthenticated visitors cannot query chapter RPCs',async()=>{
  const x=setup({auth:false});await tick();assert.equal(x.calls.length,0);
  assert.match(x.document.querySelector('#tbjMyReadingStatus').textContent,/Inicia sesión/);
});
