import {ACCOUNTS, EVENTS, PaymentError, SITE, UUID, assertSession, checkoutParameters, checkoutResponse, snapshot, validateInput} from './stripe-core.ts';

const cors = {'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin'};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,
  headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
function failure(error: any) {
  if (error instanceof PaymentError) return reply({error: error.message, code: error.code}, error.status);
  // No Stripe payload, secret, email or stack is exposed in the response or logs.
  return reply({error: 'No se pudo verificar el pago. Puedes volver a consultar sin pagar de nuevo.', code: 'PAYMENT_SERVICE_UNAVAILABLE'}, 503);
}
async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 12000) throw new PaymentError('Solicitud demasiado grande.', 413);
  try {return JSON.parse(raw);} catch {throw new PaymentError('Solicitud inválida.');}
}
export function createCheckoutHandler(services: any) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return reply({});
    if (req.method !== 'POST') return reply({error: 'Método no permitido'}, 405);
    try {
      const origin = req.headers.get('Origin');
      if (origin && origin !== SITE) throw new PaymentError('Origen de pago no habilitado.', 403);
      const user = await services.authenticate(req);
      if (user.is_anonymous) throw new PaymentError('Confirma tu cuenta antes de aportar.', 403);
      const input = validateInput(await body(req));
      const settings = await services.settings();
      if (!settings.checkout_enabled) throw new PaymentError('Estamos terminando de habilitar las aportaciones.', 503, 'PAYMENTS_NOT_ENABLED');
      const {stripe, accountId, webhookSecret} = await services.provider(settings.livemode);
      if (!webhookSecret?.startsWith('whsec_')) throw new Error('Webhook signing secret missing');
      const account = await stripe.accounts.retrieve();
      if (account.id !== accountId || accountId !== ACCOUNTS[settings.livemode ? 'live' : 'test'] || !account.charges_enabled)
        throw new PaymentError('La cuenta de cobro todavía no está disponible.', 503, 'ACCOUNT_NOT_READY');
      const order = await services.reserve(user.id, settings.livemode, input);
      if (['approved','refunded','partially_refunded','disputed','charged_back','processing','cancelled'].includes(order.status))
        throw new PaymentError('Consulta esta aportación antes de iniciar otro pago.',409,'PAYMENT_ALREADY_PROCESSED');
      let session;
      if (order.session_id) session = await stripe.checkout.sessions.retrieve(order.session_id);
      else {
        // Stripe expires idempotency keys after 24h. Never recreate an old unknown attempt.
        if (order.checkout_expires_at < Math.floor(Date.now()/1000) + 1800)
          throw new PaymentError('Este intento venció. Inicia una nueva aportación.',409,'CHECKOUT_EXPIRED');
        session = await stripe.checkout.sessions.create(checkoutParameters(order), {idempotencyKey: 'tbj:'+order.id});
        assertSession(order, session, accountId);
        await services.attach(order.id, session.id);
      }
      assertSession(order, session, accountId);
      if (session.status === 'expired') throw new PaymentError('Este intento venció. Inicia una nueva aportación.',409,'CHECKOUT_EXPIRED');
      return reply(checkoutResponse(order, session));
    } catch (error) {return failure(error);}
  };
}

export function createStatusHandler(services: any) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return reply({});
    if (req.method !== 'POST') return reply({error:'Método no permitido'},405);
    try {
      const user = await services.authenticate(req);
      const input = await body(req);
      if (!UUID.test(input.reference || '')) throw new PaymentError('Referencia inválida.');
      const order = await services.findOwned(input.reference, user.id);
      if (!order) throw new PaymentError('Aportación no encontrada.',404);
      // Status endpoint never fulfills: only an authenticated Stripe event can publish.
      return reply({provider:'stripe',status:order.status,amount:order.amount/100,currency:order.currency.toUpperCase(),
        plan:order.plan,environment:order.livemode?'production':'sandbox',amountRefunded:order.amount_refunded/100});
    } catch (error) {return failure(error);}
  };
}

export function createWebhookHandler(services: any) {
  return async (req: Request) => {
    if (req.method !== 'POST') return reply({error:'Método no permitido'},405);
    try {
      const mode = new URL(req.url).searchParams.get('mode');
      if (mode !== 'test' && mode !== 'live') return reply({error:'Entorno inválido'},400);
      const live = mode === 'live';
      const {stripe, accountId, webhookSecret, cryptoProvider} = await services.provider(live);
      if (!webhookSecret) return reply({error:'Webhook no configurado'},503);
      const signature = req.headers.get('stripe-signature');
      if (!signature) return reply({error:'Firma requerida'},400);
      const raw = await req.text();
      if (raw.length > 262144) return reply({error:'Evento demasiado grande'},413);
      let event;
      try {event = await stripe.webhooks.constructEventAsync(raw,signature,webhookSecret,300,cryptoProvider);}
      catch {return reply({error:'Firma inválida'},400);}
      if (event.livemode !== live || (event.account && event.account !== accountId)) return reply({error:'Cuenta o entorno inválido'},400);
      if (!EVENTS.includes(event.type)) return reply({received:true,ignored:true});
      const object = event.data.object;
      let reference, intentId;
      if (object.object === 'checkout.session') reference = object.client_reference_id;
      else if (object.object === 'payment_intent') {reference = object.metadata?.order_id; intentId = object.id;}
      else {
        intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
        if (!intentId && object.object === 'dispute' && object.charge) {
          const charge = await stripe.charges.retrieve(typeof object.charge === 'string' ? object.charge : object.charge.id);
          intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        }
        if (intentId) reference = (await stripe.paymentIntents.retrieve(intentId)).metadata?.order_id;
      }
      if (!UUID.test(reference || '')) return reply({received:true,ignored:true});
      const order = await services.find(reference);
      if (!order) return reply({received:true,ignored:true});
      if (order.livemode !== live || order.account_id !== accountId) return reply({error:'Cuenta o entorno inválido'},400);
      let sessionId = order.session_id;
      // A fast payment event may arrive before the create call persists its response.
      if (!sessionId && object.object === 'checkout.session') sessionId = object.id;
      if (!sessionId) return reply({error:'Checkout aún no registrado; reintentar'},503);
      const session = await stripe.checkout.sessions.retrieve(sessionId, {expand:['payment_intent.latest_charge']});
      const result = snapshot(order, session, accountId);
      if (intentId && result.payment_intent_id !== intentId) throw new Error('Unrelated PaymentIntent event');
      if (result.status === 'disputed') {
        const charge = session.payment_intent.latest_charge;
        const disputes = await stripe.disputes.list({charge:charge.id,limit:100});
        if (disputes.has_more || !disputes.data.length) throw new Error('Unresolved dispute state');
        if (disputes.data.some((d:any)=>d.status==='lost')) result.status='charged_back';
        else if (disputes.data.every((d:any)=>['won','warning_closed'].includes(d.status)))
          result.status=result.amount_refunded ? (result.amount_refunded===order.amount?'refunded':'partially_refunded') : 'approved';
      }
      const applied = await services.apply(order, event, result);
      return reply({received:true,...applied});
    } catch (error) {return failure(error);}
  };
}
