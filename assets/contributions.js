/* Stripe checkout and legacy receipt lookup. No card data or secret keys enter the app. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), prices={bronce:180,plata:360,oro:720,diamante:1800};
const native=!!window.Capacitor?.isNativePlatform?.();
const show=(id,text)=>{if($(id))$(id).textContent=text;};
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const remove=key=>{try{localStorage.removeItem(key);}catch{}};
let busy=false,generation=0,timer=null,account;
async function call(name,body){
 const {data}=await sb.auth.getSession();
 if(!data.session?.access_token)throw Error('Inicia sesión para continuar.');
 const response=await fetch(SUPABASE_URL+'/functions/v1/'+name,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,
  Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 let result;try{result=await response.json();}catch{throw Error('No hubo respuesta del servicio.');}
 if(!response.ok){const error=Error(result.error||'No se pudo verificar el pago.');error.code=result.code;throw error;}
 return result;
}
async function checkout(plan,context={},statusId='generalMercadoPagoStatus'){
 if(native)throw Error('Las aportaciones y ampliaciones no están habilitadas en esta versión móvil.');
 if(busy)return;
 if(!Object.hasOwn(prices,plan))throw Error('Elige una aportación válida.');
 busy=true;const ticket=generation;show(statusId,'Preparando tu aportación…');
 try{
  const auth=await sb.auth.getUser();if(auth.error||!auth.data?.user)throw Error('Inicia sesión para continuar.');
  const signature=JSON.stringify({user:auth.data.user.id,plan,...context});
  let attempt=read('tbj_stripe_attempt');
  if(!attempt||attempt.signature!==signature){attempt={signature,requestId:crypto.randomUUID()};save('tbj_stripe_attempt',attempt);}
  const result=await call('create-stripe-checkout',{plan,...context,amount:prices[plan],currency:'MXN',platform:'web',locale:'es',requestId:attempt.requestId});
  if(ticket!==generation)return;
  if(result.provider!=='stripe'||result.amount!==prices[plan]||result.currency!=='MXN')throw Error('El importe del cobro no coincide. No se abrió el pago.');
  const url=new URL(result.checkoutUrl);
  if(url.origin!=='https://checkout.stripe.com'||url.username||url.password)throw Error('Destino de pago inválido.');
  if(result.environment!=='production'&&!confirm('Este es un pago de PRUEBA. No es una aportación real. ¿Continuar?')){show(statusId,'Prueba cancelada. No se realizó ningún cobro.');return;}
  save('tbj_pending_payment',{provider:'stripe',externalReference:result.externalReference,userId:auth.data.user.id});
  location.assign(url.href);
 }catch(error){if(error.code==='CHECKOUT_EXPIRED')remove('tbj_stripe_attempt');throw error;}
 finally{busy=false;}
}
window.startGeneralContribution=async(plan,event)=>{event?.preventDefault();try{await checkout(String(plan).toLowerCase());}catch(error){show('generalMercadoPagoStatus',error.message);}};
window.publishDonationReal=async()=>{
 try{
  const room=window.selectedRealRoom;if(!room?.id)throw Error('Primero entra a una sala.');
  const plan=typeof selectedDonationTierReal!=='undefined'?String(selectedDonationTierReal.name).toLowerCase():'bronce';
  await checkout(plan,{roomId:room.id,donorName:$('donorNameInput')?.value||'',message:$('donationMessageInput')?.value||'',anonymous:!!$('donationAnonymousInput')?.checked},'donationStatus');
 }catch(error){show('donationStatus',error.message);}
};
const states={creating:'Preparando la aportación.',pending:'El pago sigue pendiente de confirmación.',processing:'El pago está en proceso.',in_process:'El pago está en revisión.',
 approved:'Pago confirmado. Gracias por tu aportación.',rejected:'El pago fue rechazado. Puedes revisar el método de pago.',cancelled:'El intento de pago venció o fue cancelado.',
 refunded:'El pago fue reembolsado.',partially_refunded:'Se realizó un reembolso parcial.',disputed:'El pago está en disputa. La dedicatoria está suspendida.',charged_back:'El pago fue revertido.'};
async function status(remaining=0){
 clearTimeout(timer);const ticket=++generation;
 const query=new URLSearchParams(location.search),pending=read('tbj_pending_payment')||read('tbj_pending_mercadopago');
 const reference=query.get('reference')||pending?.externalReference;
 const provider=query.has('reference')?(query.get('provider')||'mercadopago'):(pending?.provider||'mercadopago');
 if(!reference){show('tbjPaymentStatus','No tienes una aportación pendiente en este dispositivo.');return;}
 show('tbjPaymentStatus','Consultando confirmación del pago…');
 try{
  const data=await call(provider==='stripe'?'stripe-payment-status':'payment-status',{reference});
  if(ticket!==generation)return;
  const test=data.environment!=='production';
  show('tbjPaymentStatus',test&&data.status==='approved'?'PRUEBA confirmada. No se publicará como una aportación real.':
   (test?'PRUEBA — ':'')+(states[data.status]||'Estado pendiente de revisión.'));
  if(provider==='stripe'&&['approved','refunded','partially_refunded','disputed','charged_back','cancelled'].includes(data.status))remove('tbj_stripe_attempt');
  if(provider==='mercadopago'&&['approved','refunded','rejected','cancelled','charged_back'].includes(data.status))remove('tbj_checkout_attempt');
  if(remaining>0&&['creating','pending','processing','in_process'].includes(data.status)&&location.hash==='#estado_aportacion')timer=setTimeout(()=>status(remaining-1),3000);
 }catch(error){if(ticket===generation)show('tbjPaymentStatus',error.message);}
}
window.tbjCheckPayment=()=>status(10);
$('tbjCheckPayment')?.addEventListener('click',window.tbjCheckPayment);
window.addEventListener('hashchange',()=>{if(location.hash!=='#estado_aportacion'){++generation;clearTimeout(timer);}});
sb.auth.onAuthStateChange((event,session)=>{
 const next=session?.user?.id||null;
 if(event==='SIGNED_OUT'||(account!==undefined&&account!==next)){
  ++generation;clearTimeout(timer);remove('tbj_stripe_attempt');remove('tbj_pending_payment');
  show('tbjPaymentStatus','Inicia sesión para consultar tus aportaciones.');
 }
 account=next;
});
if(new URLSearchParams(location.search).has('reference')){location.hash='#estado_aportacion';status(10);}
})();
