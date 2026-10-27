# Stripe integration — 27 October 2026

## Verified account and scope

- Live Tehilim: `acct_1UUpeNBEQsp1gX44`. Dedicated sandbox: `acct_1UUpenBg7lIT6wk2`.
- Both accounts are now available through the authorized connector. Cotizaciones/Programación is not used.
- Starting production commit: `fd072394ea0dae93131f10dfcbd2ddcd9cbe41d5`.
- Backup: `backup/before-stripe-20261027`.
- No real charge, refund, payout, subscription or paid add-on was initiated.

## Implemented

- Server catalog fixes MXN 180/360/720/1800 in integer cents. Checkout uses dynamic eligible methods and explicitly disables adaptive currency conversion and unconfigured automatic tax.
- User authentication, non-anonymous account check, room membership, server-side idempotency (including two tabs), stable Stripe idempotency keys, and per-user rate limiting.
- Dedicated live/test account checks. Checkout closes safely when disabled, keys are absent, account is wrong or payments are unavailable.
- Signed raw-body webhooks, 5-minute timestamp tolerance, authoritative Session/PaymentIntent/Charge verification, currency/amount/reference/account/environment checks.
- Event persistence, order transition and publication are one transaction. Duplicate events do not duplicate dedications. Stale events cannot undo refunds. Failed processing returns a retryable status.
- Pending, processing, declined, expired, paid, refunded, partially refunded, disputed and charged-back states.
- Only a verified live approved order publishes a room dedication. Test payments never publish. Refunds/disputes unpublish. Anonymous names are erased. Room members alone can read dedications; payment records remain server-only.
- Account deletion clears stored names/messages and hides the dedication while preserving financial totals.
- Frontend preserves the existing design and amounts, supports Stripe checkout/status and historical Mercado Pago receipt lookup. No chapter RPC was changed.

## Supabase deployed

New Edge Functions (version 2): `create-stripe-checkout`, `stripe-payment-status`, `stripe-webhook`.

Applied migrations:

1. `stripe_payment_orders_and_verified_contributions`
2. `stripe_service_role_ownership_check` — removed unnecessary direct access to auth.users; authenticated Edge requests and FK validate identity.
3. `stripe_server_membership_read_grants` — server-only SELECT on rooms and memberships; no client grant added.
4. `stripe_webhook_vault_access`

Final replayable SQL is in `supabase/changes/stripe-payments.sql` and `stripe-webhook-vault.sql`.

New relations: `payment_settings`, `payment_orders`, `payment_events`, `verified_contributions`, `room_verified_contributions` (security-invoker view). The first three have no client grants and deliberately no client RLS policies.

Checkout remains disabled: `payment_settings.checkout_enabled=false`, `livemode=false`.

Stripe webhook destinations:

- Test: `we_1UV1wJBg7lIT6wk2VAIseV6u` → `https://yxsustuawcqjewygvxbg.supabase.co/functions/v1/stripe-webhook?mode=test`
- Live: `we_1UV1wKBEQsp1gX44UWfCbYmj` → same URL with `mode=live`.

Signing secrets were saved directly to encrypted Supabase Vault as `tbj_stripe_webhook_test` and `tbj_stripe_webhook_live`, without printing or committing their values. `tbj_stripe_signing_secret(boolean)` is executable only by service_role; its availability was checked under that role. Optional Edge environment overrides are `STRIPE_TEST_WEBHOOK_SECRET` and `STRIPE_LIVE_WEBHOOK_SECRET`.

## Tests actually run

- 107 JavaScript/TypeScript tests pass (77 existing + 21 backend Stripe + 9 payment UI).
- Tests use the real Stripe SDK for webhook signature verification; provider and app repositories are otherwise mocked in these unit tests.
- Deno type-check of all three Edge entrypoints passes.
- Live PostgreSQL rollback test `tests/stripe-database.sql` passes under service_role/authenticated/anon. Covers retry identity, two-tab logical reuse, room access, duplicate/stale events, partial refunds, publication privacy, atomic failure and erasure. Fixtures all rolled back.
- Public deployed create/status endpoints return 401 without a user token. Unconfigured webhook returns 503; this is not a successful delivery test.
- `npm run check` and production asset build pass: 150 Psalms / 2,527 verses aligned, 33 offline assets.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- A real sandbox API call created an **unpaid** Checkout Session for exactly 18,000 MXN cents. See `docs/evidence/stripe-checkout-20261027.json`. No test card was charged and no app fulfillment was exercised by this call.
- The provider call caught a version change: `ui_mode=hosted` is rejected by the current API; corrected to `hosted_page` and then verified with Stripe.

## Remaining activation work — do not claim complete

The connector's OAuth authorization does not install a Stripe API credential in the app server. Edge secrets still need:

- `STRIPE_TEST_RESTRICTED_KEY` (`rk_test_…`) for the dedicated Tehilim sandbox.
- `STRIPE_LIVE_RESTRICTED_KEY` (`rk_live_…`) for the real Tehilim account.

Use restricted keys. Required API operations: own account retrieval, Checkout Session creation/retrieval, inline Price/Product creation as required by Checkout, PaymentIntent/Charge/Dispute retrieval. No refund creation, payout, transfer or bank-account modification is implemented. Confirm exact key permission dependencies with the Stripe form and real sandbox requests. Never commit or send secret values through chat.

After test key installation: enable sandbox checkout only, test the authenticated app flow with approved/declined/asynchronous test methods, observe signed event delivery and order updates, resend an event, refund a test payment and verify that no dedication is published. Also verify cross-user lookup and UI privacy. Only after this should live settings be enabled and the frontend promoted. A real charge still requires specific user authorization.

Native payment buttons remain gated. Apple requires store billing for digital upgrades, with regional exceptions; approved nonprofit fundraising has separate conditions. Google distinguishes digital purchases and tax-exempt donations. This mixed support/developer contribution is not claimed to be an approved tax-exempt nonprofit. The new Stripe work does not resolve native billing eligibility, signed store packages, physical-device testing, remaining religious texts or full English/Hebrew UI.

Sources checked 27 October 2026:
- https://developer.apple.com/app-store/review/guidelines/ (3.1.1, 3.2.1, 3.2.2)
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://supabase.com/docs/guides/functions/examples/stripe-webhooks
- https://supabase.com/docs/guides/database/vault
- Stripe MCP API schema and Stripe SDK 23.0.1 (`2026-09-30.endive`).

Existing security notices remain: eight intentional authenticated chapter/room SECURITY DEFINER functions and disabled leaked-password protection. No protection was disabled to silence an advisor.
