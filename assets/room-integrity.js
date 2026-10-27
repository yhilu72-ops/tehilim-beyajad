/* One active room and one verified contribution source for all inherited screens. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Original scripts use both a global lexical variable and window.selectedRealRoom.
// Keep them identical when joining, restoring, leaving or deleting a room.
if(typeof selectedRealRoom!=='undefined'){
  const restored=window.selectedRealRoom;
  if(restored?.id)selectedRealRoom=restored;
  Object.defineProperty(window,'selectedRealRoom',{configurable:true,get:()=>selectedRealRoom,set:value=>{selectedRealRoom=value;}});
}
let generation=0;
const lists=['tbjContributions','roomDonationsListV58','donationListV49'];
const banners=['latestDonationBannerV52','latestDonationBannerV53'];
function clearBanners(){for(const id of banners){const el=$(id);if(el){el.replaceChildren();el.classList.remove('show');}}}
function message(text){for(const id of lists){const el=$(id);if(el)el.textContent=text;}clearBanners();}
function card(item){const name=item.anonymous?'Anónimo':item.donor_name||'Aportante';return '<div class="v58ListItem"><span class="v58Badge">Aportación '+escape(item.plan)+'</span><p><b>'+escape(name)+'</b></p><p>'+escape(item.message)+'</p></div>';}
async function refresh(){
  const ticket=++generation,roomId=window.selectedRealRoom?.id;
  message(roomId?'Consultando aportaciones confirmadas…':'Entra a una sala para ver sus aportaciones.');
  if(!roomId)return;
  try{
    const auth=await sb.auth.getUser();
    if(ticket!==generation||window.selectedRealRoom?.id!==roomId)return;
    if(auth.error||!auth.data?.user){message('Inicia sesión para ver las aportaciones de la sala.');return;}
    const result=await sb.from('room_verified_contributions').select('donor_name,message,anonymous,plan,created_at').eq('room_id',roomId).eq('published',true).order('created_at',{ascending:false}).limit(100);
    if(ticket!==generation||window.selectedRealRoom?.id!==roomId)return;
    if(result.error)throw result.error;
    const items=result.data||[];
    for(const id of lists){const el=$(id);if(el)el.innerHTML=items.length?items.map(card).join(''):'<p class="muted">Todavía no hay aportaciones confirmadas en esta sala.</p>';}
    // Older markup may contain two banners; show only the newest container.
    const banner=$('latestDonationBannerV53')||$('latestDonationBannerV52');
    if(banner&&items.length){banner.innerHTML='<h3>Última aportación confirmada</h3>'+card(items[0])+'<a href="#dedicaciones_sala_v58">Ver aportaciones</a>';banner.classList.add('show');}
  }catch(error){if(ticket===generation&&window.selectedRealRoom?.id===roomId)message('No se pudieron verificar las aportaciones. Intenta actualizar.');}
}
for(const name of ['loadLatestDonationBannerV52','loadLatestDonationBannerV53','loadLatestDonationBannerV54','loadLatestDonationBannerV57','loadRoomDonationsV58','renderDonationsV49','loadDonationRoomV49','loadDonationRoomV50'])window[name]=refresh;
// Retire the historical local-only dedication flow; preserve the actual checkout form.
window.getDonationsV49=()=>[];
window.saveDonationV49=()=>{location.hash='#donar';};
window.setDonationsV49=()=>{};
window.tbjRefreshContributions=refresh;
function clearAccountRoom(){
  ++generation;
  window.selectedRealRoom=null;
  window.searchRoomResultV50=null;
  try{for(const key of Object.keys(localStorage))if(/^(activeRoom|donations_|tehilim_donations_|tbj_reza_|tbj_prayer_requests_)/.test(key))localStorage.removeItem(key);}catch{}
  message('Inicia sesión para ver las aportaciones de la sala.');
}
let account;
sb.auth.onAuthStateChange((event,session)=>{
  const next=session?.user?.id||null;
  if(event==='SIGNED_OUT'||(event==='INITIAL_SESSION'&&!next)||(account!==undefined&&account!==next))clearAccountRoom();
  account=next;
});
window.addEventListener('hashchange',()=>{if(['#sala_real','#dedicaciones_sala_v58','#dedicar_sala'].includes(location.hash))refresh();});
if(['#sala_real','#dedicaciones_sala_v58','#dedicar_sala'].includes(location.hash))refresh();
})();
