import Stripe from 'npm:stripe@23.0.1';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {ACCOUNTS, API_VERSION, PaymentError} from './stripe-core.ts';

export function runtime() {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
  const db = createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked = (r:any) => {if(r.error) throw r.error;return r.data;};
  return {
    async authenticate(req:Request) {
      const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
      if (!token) throw new PaymentError('Inicia sesión para continuar.',401);
      const {data,error}=await db.auth.getUser(token);
      if(error||!data.user)throw new PaymentError('Inicia sesión para continuar.',401);
      return data.user;
    },
    async settings() {return checked(await db.from('payment_settings').select('checkout_enabled,livemode').eq('id',true).single());},
    async provider(live:boolean) {
      const mode=live?'LIVE':'TEST';
      const key=Deno.env.get('STRIPE_'+mode+'_RESTRICTED_KEY');
      if (!key || !new RegExp('^rk_'+(live?'live':'test')+'_').test(key)) throw new Error('Stripe restricted key is missing or has the wrong mode');
      const stripe = new Stripe(key,{apiVersion:API_VERSION,httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:12000});
      const webhookSecret=Deno.env.get('STRIPE_'+mode+'_WEBHOOK_SECRET') || checked(await db.rpc('tbj_stripe_signing_secret',{p_livemode:live}));
      return {stripe,accountId:ACCOUNTS[live?'live':'test'],webhookSecret,cryptoProvider:Stripe.createSubtleCryptoProvider()};
    },
    async reserve(userId:string,live:boolean,input:any) {
      const {request_id,...logical}=input;
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(logical)));
      const fingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      const r=await db.rpc('tbj_reserve_stripe_order',{p_user:userId,p_livemode:live,p_input:input,p_fingerprint:fingerprint});
      if(r.error){const message=r.error.message;
        if(message.includes('ROOM_ACCESS_DENIED'))throw new PaymentError('Únete a la sala antes de aportar.',403);
        if(message.includes('REQUEST_CONFLICT'))throw new PaymentError('Este intento corresponde a otra aportación.',409,'REQUEST_CONFLICT');
        if(message.includes('RATE_LIMIT'))throw new PaymentError('Espera un minuto antes de volver a intentar.',429,'RATE_LIMIT');
      }
      return checked(r);
    },
    async attach(id:string,session:string) {
      // Webhook may have already bound it. Never replace a different session.
      const r=await db.from('payment_orders').update({session_id:session,status:'pending'}).eq('id',id).is('session_id',null).eq('status','creating');
      checked(r);
    },
    async find(id:string){return checked(await db.from('payment_orders').select('*').eq('id',id).maybeSingle());},
    async findOwned(id:string,user:string){return checked(await db.from('payment_orders').select('status,amount,currency,plan,livemode,amount_refunded').eq('id',id).eq('user_id',user).maybeSingle());},
    async apply(order:any,event:any,snapshot:any){return checked(await db.rpc('tbj_apply_stripe_event',{
      p_order:order.id,p_account:order.account_id,p_livemode:order.livemode,p_event:event.id,p_type:event.type,p_created:event.created,p_snapshot:snapshot}));},
  };
}
