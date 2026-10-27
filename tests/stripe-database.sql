-- All fixtures, events and publications roll back; no real payment is made.
begin;
select set_config('test.stripe_a',gen_random_uuid()::text,true),set_config('test.stripe_b',gen_random_uuid()::text,true),
 set_config('test.stripe_r',gen_random_uuid()::text,true),set_config('test.stripe_key',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.stripe_a')::uuid,'tbj-stripe-a@example.invalid'),(current_setting('test.stripe_b')::uuid,'tbj-stripe-b@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code)
 values(current_setting('test.stripe_r')::uuid,current_setting('test.stripe_a')::uuid,'Stripe transaction test','refua_shelema','Test','private','TSTSTRIPE27');
set local role service_role;
do $$declare input jsonb; a public.payment_orders; b public.payment_orders; snap jsonb; result jsonb;
begin
 input:=jsonb_build_object('request_id',current_setting('test.stripe_key'),'room_id',current_setting('test.stripe_r'),
  'plan','bronce','amount',18000,'currency','mxn','donor_name','','message','Synthetic dedication','anonymous',true,'locale','es');
 a:=public.tbj_reserve_stripe_order(current_setting('test.stripe_a')::uuid,true,input,'synthetic-fingerprint');
 perform set_config('test.stripe_order',a.id::text,true);
 b:=public.tbj_reserve_stripe_order(current_setting('test.stripe_a')::uuid,true,input,'synthetic-fingerprint');
 if a.id<>b.id then raise exception 'Duplicate request created two orders';end if;
 b:=public.tbj_reserve_stripe_order(current_setting('test.stripe_a')::uuid,true,input||jsonb_build_object('request_id',gen_random_uuid()),'synthetic-fingerprint');
 if a.id<>b.id then raise exception 'Second tab created another active order';end if;
 begin
  perform public.tbj_reserve_stripe_order(current_setting('test.stripe_a')::uuid,true,input,'changed-fingerprint');
  raise exception 'Conflicting retry accepted';
 exception when raise_exception then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
 begin
  perform public.tbj_reserve_stripe_order(current_setting('test.stripe_b')::uuid,true,input,'outside-room');
  raise exception 'Nonmember could contribute to private room';
 exception when raise_exception then if sqlerrm<>'ROOM_ACCESS_DENIED' then raise;end if;end;
 snap:=jsonb_build_object('session_id','cs_live_synthetic','payment_intent_id','pi_synthetic','status','pending','amount_refunded',0);
 perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_pending','checkout.session.completed',1,snap);
 if exists(select 1 from public.verified_contributions where order_id=a.id) then raise exception 'Unpaid contribution published';end if;
 snap:=snap||'{"status":"approved"}'::jsonb;
 perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_approved','checkout.session.async_payment_succeeded',2,snap);
 result:=public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_approved','checkout.session.async_payment_succeeded',2,snap);
 if result->>'duplicate'<>'true' then raise exception 'Duplicate event not detected';end if;
 if (select count(*) from public.verified_contributions where order_id=a.id and published)<>1 then raise exception 'Expected exactly one publication';end if;
 if (select donor_name from public.verified_contributions where order_id=a.id)<>'' then raise exception 'Anonymous name exposed';end if;
 perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_refund','charge.refunded',3,snap||'{"status":"partially_refunded","amount_refunded":9000}'::jsonb);
 perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_stale','checkout.session.completed',1,snap);
 perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_late_paid','checkout.session.completed',4,snap);
 if (select status from public.payment_orders where id=a.id)<>'partially_refunded' then raise exception 'Refund regressed';end if;
 if exists(select 1 from public.verified_contributions where order_id=a.id and published) then raise exception 'Refunded payment still published';end if;
 begin
  perform public.tbj_apply_stripe_event(a.id,a.account_id,true,'evt_synthetic_wrong_session','checkout.session.completed',5,snap||'{"session_id":"cs_live_wrong"}'::jsonb);
  raise exception 'Session reassigned';
 exception when raise_exception then if sqlerrm<>'SESSION_MISMATCH' then raise;end if;end;
 if exists(select 1 from public.payment_events where event_id='evt_synthetic_wrong_session') then raise exception 'Failed event marked processed';end if;
 -- A sandbox success can never appear as a real dedication.
 b:=public.tbj_reserve_stripe_order(current_setting('test.stripe_a')::uuid,false,input,'sandbox-fingerprint');
 perform public.tbj_apply_stripe_event(b.id,b.account_id,false,'evt_synthetic_test','checkout.session.completed',1,
  jsonb_build_object('session_id','cs_test_synthetic','payment_intent_id','pi_test_synthetic','status','approved','amount_refunded',0));
 if exists(select 1 from public.verified_contributions where order_id=b.id) then raise exception 'Sandbox published';end if;
 -- Restore fixture publication solely to exercise member RLS, then roll back all.
 update public.verified_contributions set published=true where order_id=a.id;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.stripe_b'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.room_verified_contributions where room_id=current_setting('test.stripe_r')::uuid) then raise exception 'Private dedication exposed to nonmember';end if;
 if has_table_privilege(current_user,'public.payment_orders','select') or has_table_privilege(current_user,'public.payment_events','insert') then raise exception 'Client payment access';end if;
 if has_function_privilege(current_user,'public.tbj_apply_stripe_event(uuid,text,boolean,text,text,bigint,jsonb)','execute') then raise exception 'Client can fulfill payments';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.stripe_a'),true);
set local role authenticated;
do $$begin
 if (select count(*) from public.room_verified_contributions where room_id=current_setting('test.stripe_r')::uuid)<>1 then raise exception 'Member cannot see confirmed dedication';end if;
end $$;
reset role;
-- Mirrors the FK update when an account is erased; financial totals are retained.
update public.payment_orders set user_id=null where id=current_setting('test.stripe_order')::uuid;
do $$begin
 if exists(select 1 from public.payment_orders where id=current_setting('test.stripe_order')::uuid and (message<>'' or donor_name<>'' or not anonymous)) then raise exception 'Account erasure kept identity';end if;
 if exists(select 1 from public.verified_contributions where order_id=current_setting('test.stripe_order')::uuid and published) then raise exception 'Erased identity still public';end if;
 if has_table_privilege('anon','public.payment_orders','select') or has_table_privilege('anon','public.room_verified_contributions','select') then raise exception 'Anonymous payment access';end if;
end $$;
select 'PASS: service-role execution, retries/multiple tabs, membership, idempotent events, pending/test suppression, refund/stale guards, atomic failure, private publication, account erasure' as verification;
rollback;
