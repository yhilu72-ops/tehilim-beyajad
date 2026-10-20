/* Device integration; all reading assets ship inside the installed package. */
(()=>{
'use strict';
if(!window.Capacitor?.isNativePlatform?.())return;
const app=window.capacitorApp?.App,share=window.capacitorShare?.Share;
document.documentElement.classList.add('tbj-native');
if(app){
 app.addListener('appStateChange',({isActive})=>{if(isActive)window.dispatchEvent(new Event('tbj:resume'));});
 app.addListener('backButton',()=>{
  const screen=document.getElementById(location.hash.slice(1));
  const back=screen?.querySelector('.top a.circle[href^="#"]');
  if(back&&back.hash!==location.hash){location.hash=back.hash;return;}
  if(!['#menu','#inicio','#login',''].includes(location.hash)){location.hash='#menu';return;}
  app.minimizeApp();
 });
}
if(share){
 // Existing room-share handlers retain their exact invitation text and URL.
 Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
  const url=data.url?new URL(data.url):null;
  if(url&&(url.protocol!=='https:'||url.hostname!=='tehilim-beyajad.vercel.app'))throw Error('Enlace de invitación inválido.');
  return share.share({title:data.title||'Tehilim BeYajad',text:data.text||'',...(url?{url:url.href}:{}),dialogTitle:'Compartir sala'});
 }});
}
})();
