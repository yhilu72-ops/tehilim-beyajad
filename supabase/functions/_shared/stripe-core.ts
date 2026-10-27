// Amounts are integers in the smallest currency unit. Never accept a client price.
export const CATALOG = Object.freeze({
  bronce: {amount: 18000, title: 'Aportación Bronce'},
  plata: {amount: 36000, title: 'Aportación Plata'},
  oro: {amount: 72000, title: 'Aportación Oro'},
  diamante: {amount: 180000, title: 'Aportación Diamante'},
});
export const ACCOUNTS = {test: 'acct_1UUpenBg7lIT6wk2', live: 'acct_1UUpeNBEQsp1gX44'};
export const SITE = 'https://tehilim-beyajad.vercel.app';
export const API_VERSION = '2026-09-30.endive';
export const INTEGRATION_ID = 'tehilim_contributions_v1_jqvmdrks';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PaymentError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'INVALID_REQUEST') {
    super(message); this.status = status; this.code = code;
  }
}
export function validateInput(body: any) {
  if (!body || !Object.hasOwn(CATALOG, body.plan) || !UUID.test(body.requestId || ''))
    throw new PaymentError('Aportación o identificador inválido.');
  if (body.platform && body.platform !== 'web')
    throw new PaymentError('Los cobros de esta versión móvil aún no están habilitados.', 403, 'NATIVE_PAYMENTS_UNAVAILABLE');
  const item = CATALOG[body.plan as keyof typeof CATALOG];
  if ((body.currency && body.currency !== 'MXN') || (body.amount !== undefined && body.amount !== item.amount / 100))
    throw new PaymentError('El importe debe coincidir con el precio en pesos mexicanos.', 409, 'PRICE_MISMATCH');
  if (body.roomId && !UUID.test(body.roomId)) throw new PaymentError('Sala inválida.');
  if (body.anonymous !== undefined && typeof body.anonymous !== 'boolean') throw new PaymentError('Privacidad inválida.');
  const anonymous = body.anonymous === true;
  const donorName = anonymous ? '' : String(body.donorName || '').trim().slice(0, 100);
  const message = String(body.message || '').trim().slice(0, 500);
  // Explicitly price in MXN. Future currencies need their own approved server catalog.
  return {plan: body.plan, request_id: body.requestId, room_id: body.roomId || null,
    amount: item.amount, currency: 'mxn', anonymous, donor_name: donorName, message,
    locale: ['es', 'en', 'he'].includes(body.locale) ? body.locale : 'es'};
}
export function checkoutParameters(order: any) {
  const item = CATALOG[order.plan as keyof typeof CATALOG];
  if (!item || order.amount !== item.amount || order.currency !== 'mxn') throw new Error('Invalid stored catalog price');
  return {
    mode: 'payment', ui_mode: 'hosted_page', locale: order.locale,
    integration_identifier: INTEGRATION_ID,
    client_reference_id: order.id,
    metadata: {order_id: order.id, integration: 'tehilim_contributions_v1'},
    payment_intent_data: {metadata: {order_id: order.id, integration: 'tehilim_contributions_v1'}},
    line_items: [{quantity: 1, price_data: {currency: order.currency, unit_amount: order.amount,
      product_data: {name: item.title + ' — Tehilim BeYajad',
        description: 'Aportación voluntaria al Kolel Siaj Israel y al mantenimiento de Tehilim BeYajad. No desbloquea funciones digitales.'}}}],
    // Keep the amount/currency identical to the app; don't collect tax without a registration.
    adaptive_pricing: {enabled: false}, automatic_tax: {enabled: false},
    phone_number_collection: {enabled: false},
    expires_at: order.checkout_expires_at,
    success_url: SITE + '/?provider=stripe&reference=' + order.id + '#estado_aportacion',
    cancel_url: SITE + '/?provider=stripe&reference=' + order.id + '#estado_aportacion',
  };
}
export function assertSession(order: any, session: any, accountId: string) {
  if (order.account_id !== accountId || session.livemode !== order.livemode || session.mode !== 'payment' ||
    session.client_reference_id !== order.id || session.metadata?.order_id !== order.id ||
    session.metadata?.integration !== 'tehilim_contributions_v1' ||
    session.currency !== order.currency || session.amount_total !== order.amount ||
    (order.session_id && session.id !== order.session_id)) throw new Error('Payment identity or amount mismatch');
  if (!/^cs_(test|live)_/.test(session.id)) throw new Error('Invalid session id');
}
export function checkoutResponse(order: any, session: any) {
  const url = new URL(session.url || 'https://invalid.local');
  if (session.status !== 'open' || url.origin !== 'https://checkout.stripe.com' || url.username || url.password)
    throw new PaymentError('Consulta el estado de esta aportación antes de volver a pagar.', 409, 'PAYMENT_ALREADY_PROCESSED');
  return {provider: 'stripe', checkoutUrl: url.href, externalReference: order.id, amount: order.amount / 100,
    currency: order.currency.toUpperCase(), environment: order.livemode ? 'production' : 'sandbox'};
}
// The object comes from Stripe's API, never from a browser redirect or unverified JSON.
export function snapshot(order: any, session: any, accountId: string) {
  assertSession(order, session, accountId);
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  const intentId = intent?.id || null;
  if (order.payment_intent_id && order.payment_intent_id !== intentId) throw new Error('PaymentIntent changed');
  if (intent && (intent.amount !== order.amount || intent.currency !== order.currency || intent.livemode !== order.livemode ||
    intent.metadata?.order_id !== order.id)) throw new Error('PaymentIntent mismatch');
  if (charge && (charge.amount !== order.amount || charge.currency !== order.currency || charge.livemode !== order.livemode ||
    charge.payment_intent !== intentId)) throw new Error('Charge mismatch');
  const refunded = charge?.amount_refunded || 0;
  if (!Number.isSafeInteger(refunded) || refunded < 0 || refunded > order.amount) throw new Error('Invalid refund');
  let status = session.status === 'expired' ? 'cancelled' : 'pending';
  if (intent?.status === 'processing') status = 'processing';
  if (intent?.status === 'requires_payment_method' && intent.last_payment_error) status = 'rejected';
  if (intent?.status === 'canceled') status = 'cancelled';
  if (session.payment_status === 'paid') {
    if (!intent || intent.status !== 'succeeded' || intent.amount_received !== order.amount || !charge?.paid)
      throw new Error('Paid session without matching settled charge');
    status = 'approved';
  }
  if (refunded) status = refunded === order.amount ? 'refunded' : 'partially_refunded';
  if (charge?.disputed) status = 'disputed';
  return {status, amount_refunded: refunded, session_id: session.id, payment_intent_id: intentId};
}
export const EVENTS = [
  'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'checkout.session.expired', 'payment_intent.payment_failed', 'charge.refunded', 'charge.dispute.created',
  'charge.dispute.closed', 'charge.dispute.funds_reinstated',
];
