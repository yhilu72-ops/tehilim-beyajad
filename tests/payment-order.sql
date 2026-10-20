begin;
select set_config('test.payment',gen_random_uuid()::text,true);
insert into public.mercadopago_payments(id,external_reference,provider_payment_id,plan,amount_expected,currency,status,metadata,raw_payment)
values(current_setting('test.payment')::uuid,current_setting('test.payment'),'synthetic-'||current_setting('test.payment'),'bronce',180,'MXN','approved','{"environment":"sandbox"}','{"date_last_updated":"2026-10-20T12:00:00Z"}');
do $$begin
 begin
  update public.mercadopago_payments set provider_payment_id='another-'||current_setting('test.payment') where id=current_setting('test.payment')::uuid;
  raise exception 'Provider identity changed';
 exception when unique_violation then null;end;
end $$;
update public.mercadopago_payments set status='pending',raw_payment='{"date_last_updated":"2026-10-20T11:00:00Z"}' where id=current_setting('test.payment')::uuid;
do $$begin if not exists(select 1 from public.mercadopago_payments where id=current_setting('test.payment')::uuid and status='approved') then raise exception 'Stale snapshot replaced approved payment';end if;end $$;
update public.mercadopago_payments set status='refunded',raw_payment='{"date_last_updated":"2026-10-20T13:00:00Z"}' where id=current_setting('test.payment')::uuid;
do $$begin if not exists(select 1 from public.mercadopago_payments where id=current_setting('test.payment')::uuid and status='refunded') then raise exception 'New refund was not recorded';end if;end $$;
select 'PASS: immutable provider identity, stale event rejection, newer refund accepted' as verification;
rollback;
