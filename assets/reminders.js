(()=>{
'use strict';
const ids=Array.from({length:10},(_,i)=>73100+i);
function notifications(times){
 if(!Array.isArray(times)||times.length!==2||times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Elige dos horas válidas.');
 return times.flatMap((time,index)=>{const [hour,minute]=time.split(':').map(Number);return [1,2,3,4,5].map((weekday,i)=>({id:ids[index*5+i],title:'Tehilim BeYajad',body:'Un momento para tu lectura de Tehilim.',schedule:{on:{weekday,hour,minute},repeats:true},extra:{route:'#lectura'}}));});
}
async function enable(plugin,times){
 const items=notifications(times);
 let p=await plugin.checkPermissions();if(p.display!=='granted')p=await plugin.requestPermissions();
 if(p.display!=='granted')throw Error('No se autorizó mostrar notificaciones. Puedes permitirlas en los ajustes del teléfono.');
 await plugin.cancel({notifications:ids.map(id=>({id}))});
 await plugin.schedule({notifications:items});
 const pending=await plugin.getPending();
 if(!items.every(item=>pending.notifications.some(n=>n.id===item.id)))throw Error('El teléfono no confirmó todos los recordatorios. Intenta activarlos de nuevo.');
 return items.length;
}
async function disable(plugin){await plugin.cancel({notifications:ids.map(id=>({id}))});}
window.TBJReminders={notifications,enable,disable};
const root=document.getElementById('recordatorios');if(!root)return;
const status=document.getElementById('tbjReminderStatus'),save=document.getElementById('tbjReminderSave'),off=document.getElementById('tbjReminderOff');
const plugin=window.Capacitor?.isNativePlatform?.()?window.capacitorLocalNotifications?.LocalNotifications:null;
let config={morning:'08:00',evening:'22:30',enabled:false};try{config={...config,...JSON.parse(localStorage.getItem('tbj_reminders')||'{}')};}catch{}
for(const [id,key] of [['tbjReminderMorning','morning'],['tbjReminderEvening','evening']])document.getElementById(id).value=config[key];
function persist(){try{localStorage.setItem('tbj_reminders',JSON.stringify(config));}catch{}}
if(!plugin){save.disabled=true;off.disabled=true;status.textContent='Los avisos del teléfono estarán disponibles en la aplicación instalada para iPhone y Android. Esta versión web no envía avisos con la página cerrada.';return;}
async function action(fn){save.disabled=off.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{save.disabled=off.disabled=false;}}
save.addEventListener('click',()=>action(async()=>{const times=['tbjReminderMorning','tbjReminderEvening'].map(id=>document.getElementById(id).value);config.enabled=false;persist();await enable(plugin,times);config={morning:times[0],evening:times[1],enabled:true};persist();status.textContent='Recordatorios programados de domingo a jueves, según la hora de este teléfono.';}));
off.addEventListener('click',()=>action(async()=>{await disable(plugin);config.enabled=false;persist();status.textContent='Recordatorios desactivados.';}));
plugin.getPending().then(r=>{const count=r.notifications.filter(n=>ids.includes(n.id)).length;status.textContent=count?'Hay '+count+' avisos semanales programados en este teléfono.':'No hay recordatorios programados.';}).catch(()=>{status.textContent='No se pudo consultar el estado de los recordatorios.';});
plugin.addListener('localNotificationActionPerformed',()=>{location.hash='#lectura';});
})();
