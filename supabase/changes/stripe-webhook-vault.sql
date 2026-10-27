-- Stripe returns signing secrets only when an endpoint is created. Store them
-- encrypted in Supabase Vault; never in a migration, client bundle or git.
create function public.tbj_stripe_signing_secret(p_livemode boolean) returns text
language sql stable security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets
 where name=case when p_livemode then 'tbj_stripe_webhook_live' else 'tbj_stripe_webhook_test' end;
$$;
revoke all on function public.tbj_stripe_signing_secret(boolean) from public,anon,authenticated;
grant execute on function public.tbj_stripe_signing_secret(boolean) to service_role;
