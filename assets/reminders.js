(()=>{
'use strict';
const ids=Array.from({length:10},(_,i)=>73100+i),pendingIds=[73120,73121];
function validTimes(times){
 if(!Array.isArray(times)||times.length!==2||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Elige dos horas válidas.');
}
function notifications(times){
 validTimes(times);
 return times.flatMap((time,index)=>{const [hour,minute]=time.split(':').map(Number);return [1,2,3,4,5].map((weekday,i)=>({id:ids[index*5+i],title:'Tehilim BeYajad',body:'Un momento para tu lectura de Tehilim.',schedule:{on:{weekday,hour,minute},repeats:true},extra:{route:'#lectura'}}));});
}
// One-shot reminders avoid indefinite stale claims after another device completes them.
function pendingNotifications(times,count,now=new Date()){
 validTimes(times);if(!(count>0))return [];
 return times.map((time,i)=>{const [h,m]=time.split(':').map(Number),at=new Date(now);at.setHours(h,m,0,0);
 if(at<=now)at.setDate(at.getDate()+1);
 while(at.getDay()===5||at.getDay()===6)at.setDate(at.getDate()+1);
 return {id:pendingIds[i],title:'Tehilim BeYajad',body:'Revisa si te quedan capítulos pendientes en tus salas.',schedule:{at},extra:{route:'#mis_reales'}};});
}
async function replace(plugin,items,owned){
 await plugin.cancel({notifications:owned.map(id=>({id}))});
 if(!items.length)return 0;
 try{
  await plugin.schedule({notifications:items});
  const pending=await plugin.getPending();
  if(!items.every(item=>pending.notifications.some(n=>n.id===item.id)))throw Error('El teléfono no confirmó todos los recordatorios. Intenta activarlos de nuevo.');
 }catch(error){await plugin.cancel({notifications:owned.map(id=>({id}))});throw error;}
 return items.length;
}
async function enable(plugin,times){
 const items=notifications(times);
 let p=await plugin.checkPermissions();if(p.display!=='granted')p=await plugin.requestPermissions();
 if(p.display!=='granted')throw Error('No se autorizó mostrar notificaciones. Puedes permitirlas en los ajustes del teléfono.');
 return replace(plugin,items,ids);
}
async function syncPending(plugin,times,count,now){
 const p=await plugin.checkPermissions();
 return replace(plugin,p.display==='granted'?pendingNotifications(times,count,now):[],pendingIds);
}
async function clearPending(plugin){await plugin.cancel({notifications:pendingIds.map(id=>({id}))});}
async function disable(plugin){await plugin.cancel({notifications:[...ids,...pendingIds].map(id=>({id}))});}
window.TBJReminders={notifications,pendingNotifications,enable,disable,syncPending,clearPending};
const root=document.getElementById('recordatorios');if(!root)return;
const status=document.getElementById('tbjReminderStatus'),save=document.getElementById('tbjReminderSave'),off=document.getElementById('tbjReminderOff'),pendingToggle=document.getElementById('tbjReminderPending');
const plugin=window.Capacitor?.isNativePlatform?.()?window.capacitorLocalNotifications?.LocalNotifications:null;
let config={morning:'08:00',evening:'22:30',enabled:false,pending:false};try{config={...config,...JSON.parse(localStorage.getItem('tbj_reminders')||'{}')};}catch{}
for(const [id,key] of [['tbjReminderMorning','morning'],['tbjReminderEvening','evening']])document.getElementById(id).value=config[key];
if(pendingToggle)pendingToggle.checked=config.pending;
function persist(){try{localStorage.setItem('tbj_reminders',JSON.stringify(config));}catch{}}
if(!plugin){save.disabled=true;off.disabled=true;status.textContent='Los avisos del teléfono están disponibles en la aplicación instalada para iPhone y Android.';return;}
let queue=Promise.resolve(),revision=0;
function refreshPending(){
 const current=++revision;
 queue=queue.catch(()=>{}).then(async()=>{
  if(current!==revision)return;
  if(!config.enabled||!config.pending){await clearPending(plugin);return;}
  const {data,error}=await sb.auth.getUser();
  if(current!==revision)return;
  if(error||!data.user){await clearPending(plugin);return;}
  const result=await sb.from('chapter_claims').select('id',{count:'exact',head:true}).eq('user_id',data.user.id).eq('status','claimed');
  if(current!==revision)return;
  // An offline failure does not replace an earlier verified one-shot reminder.
  if(result.error)throw Error('No se pudieron actualizar los avisos de capítulos. Se revisarán al volver a abrir la app con conexión.');
  await syncPending(plugin,[config.morning,config.evening],result.count||0);
 });return queue;
}
async function action(fn){save.disabled=off.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{save.disabled=off.disabled=false;}}
save.addEventListener('click',()=>action(async()=>{const times=['tbjReminderMorning','tbjReminderEvening'].map(id=>document.getElementById(id).value);validTimes(times);config.enabled=false;persist();++revision;await queue.catch(()=>{});await disable(plugin);await enable(plugin,times);config={morning:times[0],evening:times[1],enabled:true,pending:!!pendingToggle?.checked};persist();await refreshPending();status.textContent='Recordatorios programados de domingo a jueves, según la hora de este teléfono.';}));
off.addEventListener('click',()=>action(async()=>{config.enabled=false;persist();++revision;await queue.catch(()=>{});await disable(plugin);status.textContent='Recordatorios desactivados.';}));
plugin.getPending().then(r=>{const count=r.notifications.filter(n=>ids.includes(n.id)).length;status.textContent=count?'Hay '+count+' avisos semanales programados en este teléfono.':'No hay recordatorios programados.';}).catch(()=>{status.textContent='No se pudo consultar el estado de los recordatorios.';});
plugin.addListener('localNotificationActionPerformed',event=>{const route=event.notification?.extra?.route;location.hash=route==='#mis_reales'?route:'#lectura';});
for(const event of ['tbj:chapters-changed','tbj:resume','online'])window.addEventListener(event,()=>refreshPending().catch(e=>{status.textContent=e.message;}));
sb.auth.onAuthStateChange(()=>{setTimeout(()=>refreshPending().catch(()=>{}),0);});
refreshPending().catch(()=>{});
})();
