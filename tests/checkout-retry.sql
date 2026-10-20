begin;
select set_config('test.checkout_user',gen_random_uuid()::text,true),set_config('test.checkout_key',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.checkout_user')::uuid,'tbj-checkout-retry@example.invalid');
insert into public.mercadopago_payments(external_reference,plan,amount_expected,user_id,request_key,metadata)
values(gen_random_uuid()::text,'bronce',180,current_setting('test.checkout_user')::uuid,current_setting('test.checkout_key')::uuid,'{"environment":"sandbox"}');
do $$begin
 begin
  insert into public.mercadopago_payments(external_reference,plan,amount_expected,user_id,request_key,metadata)
  values(gen_random_uuid()::text,'bronce',180,current_setting('test.checkout_user')::uuid,current_setting('test.checkout_key')::uuid,'{"environment":"sandbox"}');
  raise exception 'Duplicate request key was accepted';
 exception when unique_violation then null; end;
 if has_table_privilege('anon','public.mercadopago_payments','select') or has_table_privilege('authenticated','public.mercadopago_payments','insert') then raise exception 'Payment data became client accessible';end if;
end $$;
select 'PASS: duplicate checkout request rejected, payment table remains server-only' as verification;
rollback;
