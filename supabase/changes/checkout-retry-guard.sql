-- Additive only: historical rows and provider payment IDs are preserved.
alter table public.mercadopago_payments add column if not exists request_key uuid;
alter table public.mercadopago_payments add column if not exists request_fingerprint text;
alter table public.mercadopago_payments add column if not exists checkout_url text;
create unique index if not exists mercadopago_user_request_key
on public.mercadopago_payments(user_id, request_key) where request_key is not null;
-- Existing server-only grants and RLS are unchanged. No client can write these fields.
