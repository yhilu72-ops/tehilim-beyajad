-- Additive migration: Mercado Pago history and chapter RPCs are unchanged.
-- The server must inspect membership; this gives no new rights to app clients.
grant select on public.rooms,public.room_members to service_role;
create table public.payment_settings (
 id boolean primary key default true check (id),
 checkout_enabled boolean not null default false,
 livemode boolean not null default false
);
insert into public.payment_settings(id) values(true);
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public,anon,authenticated;
grant all on public.payment_settings to service_role;

create table public.payment_orders (
 id uuid primary key default gen_random_uuid(),
 provider text not null default 'stripe' check(provider='stripe'),
 account_id text not null, livemode boolean not null,
 user_id uuid references auth.users(id) on delete set null,
 room_id uuid references public.rooms(id) on delete set null,
 request_id uuid not null, fingerprint text not null,
 plan text not null check(plan in ('bronce','plata','oro','diamante')),
 amount integer not null check(amount in (18000,36000,72000,180000)),
 currency text not null default 'mxn' check(currency='mxn'),
 donor_name text not null default '' check(length(donor_name)<=100),
 message text not null default '' check(length(message)<=500),
 anonymous boolean not null default false,
 locale text not null default 'es' check(locale in ('es','en','he')),
 status text not null default 'creating' check(status in ('creating','pending','processing','approved','rejected','cancelled','refunded','partially_refunded','disputed','charged_back')),
 session_id text unique, payment_intent_id text unique,
 amount_refunded integer not null default 0 check(amount_refunded between 0 and amount),
 checkout_expires_at bigint not null,
 event_created bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,livemode,request_id),
 check(account_id=case when livemode then 'acct_1UUpeNBEQsp1gX44' else 'acct_1UUpenBg7lIT6wk2' end),
 check(amount=case plan when 'bronce' then 18000 when 'plata' then 36000 when 'oro' then 72000 when 'diamante' then 180000 end),
 check(not anonymous or donor_name='')
);
create index payment_orders_user_created on public.payment_orders(user_id,created_at desc);
create index payment_orders_room on public.payment_orders(room_id);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from public,anon,authenticated;
grant all on public.payment_orders to service_role;

create table public.payment_events (
 event_id text primary key, order_id uuid not null references public.payment_orders(id),
 account_id text not null, livemode boolean not null, event_type text not null,
 event_created bigint not null, processed_at timestamptz not null default now()
);
create index payment_events_order on public.payment_events(order_id);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from public,anon,authenticated;
grant all on public.payment_events to service_role;

-- Contains only the deliberate public dedication, never payer IDs/emails/card data.
create table public.verified_contributions (
 order_id uuid primary key references public.payment_orders(id),
 room_id uuid not null references public.rooms(id) on delete cascade,
 donor_name text not null, message text not null, anonymous boolean not null,
 plan text not null, created_at timestamptz not null default now(), published boolean not null
);
create index verified_contributions_room on public.verified_contributions(room_id,created_at desc);
alter table public.verified_contributions enable row level security;
revoke all on public.verified_contributions from public,anon,authenticated;
grant select on public.verified_contributions to authenticated;
grant all on public.verified_contributions to service_role;
create policy verified_contributions_member_read on public.verified_contributions for select to authenticated
 using(published and private.tbj_member(room_id));
create view public.room_verified_contributions with(security_invoker=true) as
 select room_id,donor_name,message,anonymous,plan,created_at,published from public.room_contributions
 union all
 select room_id,donor_name,message,anonymous,plan,created_at,published from public.verified_contributions;
revoke all on public.room_verified_contributions from public,anon,authenticated;
grant select on public.room_verified_contributions to authenticated,service_role;

create function public.tbj_reserve_stripe_order(p_user uuid,p_livemode boolean,p_input jsonb,p_fingerprint text)
 returns public.payment_orders language plpgsql security invoker set search_path='' as $$
declare o public.payment_orders; r uuid:=(p_input->>'room_id')::uuid; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_livemode::text,0));
 -- Supabase Auth validated the caller in the Edge Function; the FK validates existence.
 if p_user is null then raise exception 'Invalid user';end if;
 if r is not null and not exists(select 1 from public.rooms x where x.id=r and x.active and not x.deleted
  and (x.creator_id=p_user or exists(select 1 from public.room_members m where m.room_id=r and m.user_id=p_user))) then
  raise exception 'ROOM_ACCESS_DENIED';
 end if;
 select * into o from public.payment_orders where user_id=p_user and livemode=p_livemode and request_id=(p_input->>'request_id')::uuid;
 if found then
  if o.fingerprint<>p_fingerprint then raise exception 'REQUEST_CONFLICT';end if;
  return o;
 end if;
 -- Two tabs with different request IDs still reuse the same open logical payment.
 select * into o from public.payment_orders where user_id=p_user and livemode=p_livemode and fingerprint=p_fingerprint
  and (status in ('creating','pending','rejected') and checkout_expires_at>extract(epoch from now()) or status='processing')
  order by created_at desc limit 1;
 if found then return o;end if;
 select count(*) into n from public.payment_orders where user_id=p_user and created_at>now()-interval '1 minute';
 if n>=3 then raise exception 'RATE_LIMIT';end if;
 insert into public.payment_orders(account_id,livemode,user_id,room_id,request_id,fingerprint,plan,amount,currency,donor_name,message,anonymous,locale,checkout_expires_at)
 values(case when p_livemode then 'acct_1UUpeNBEQsp1gX44' else 'acct_1UUpenBg7lIT6wk2' end,p_livemode,p_user,r,
  (p_input->>'request_id')::uuid,p_fingerprint,p_input->>'plan',(p_input->>'amount')::integer,p_input->>'currency',
  p_input->>'donor_name',p_input->>'message',(p_input->>'anonymous')::boolean,p_input->>'locale',floor(extract(epoch from now()))::bigint+3600)
 returning * into o;
 return o;
end $$;
revoke all on function public.tbj_reserve_stripe_order(uuid,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.tbj_reserve_stripe_order(uuid,boolean,jsonb,text) to service_role;

create function public.tbj_apply_stripe_event(p_order uuid,p_account text,p_livemode boolean,p_event text,p_type text,p_created bigint,p_snapshot jsonb)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.payment_orders; s text:=p_snapshot->>'status'; refunded integer:=(p_snapshot->>'amount_refunded')::integer;
begin
 select * into o from public.payment_orders where id=p_order for update;
 if not found or o.account_id<>p_account or o.livemode<>p_livemode then raise exception 'ORDER_MISMATCH';end if;
 if o.session_id is not null and o.session_id is distinct from p_snapshot->>'session_id' then raise exception 'SESSION_MISMATCH';end if;
 if o.payment_intent_id is not null and o.payment_intent_id is distinct from p_snapshot->>'payment_intent_id' then raise exception 'INTENT_MISMATCH';end if;
 if exists(select 1 from public.payment_events where event_id=p_event) then return jsonb_build_object('duplicate',true);end if;
 -- Event insertion, payment change and publication succeed or roll back together.
 insert into public.payment_events(event_id,order_id,account_id,livemode,event_type,event_created)
 values(p_event,p_order,p_account,p_livemode,p_type,p_created);
 if p_created<o.event_created then return jsonb_build_object('stale',true);end if;
 if o.status in ('approved','refunded','partially_refunded','disputed','charged_back') and s in ('creating','pending','processing','rejected','cancelled') then s:=o.status;end if;
 if o.status='charged_back' then s:='charged_back';end if;
 if o.status='disputed' and p_type not in ('charge.dispute.closed','charge.dispute.funds_reinstated') then s:='disputed';end if;
 refunded:=greatest(o.amount_refunded,refunded);
 if refunded>0 and s not in ('disputed','charged_back') then s:=case when refunded=o.amount then 'refunded' else 'partially_refunded' end;end if;
 update public.payment_orders set session_id=p_snapshot->>'session_id',payment_intent_id=p_snapshot->>'payment_intent_id',
  status=s,amount_refunded=refunded,event_created=p_created,updated_at=now() where id=p_order;
 if s='approved' and refunded=0 and o.livemode and o.room_id is not null and o.user_id is not null then
  insert into public.verified_contributions(order_id,room_id,donor_name,message,anonymous,plan,published)
  values(o.id,o.room_id,case when o.anonymous then '' else o.donor_name end,o.message,o.anonymous,o.plan,true)
  on conflict(order_id) do update set published=true;
 else
  update public.verified_contributions set published=false where order_id=o.id;
 end if;
 return jsonb_build_object('status',s);
end $$;
revoke all on function public.tbj_apply_stripe_event(uuid,text,boolean,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.tbj_apply_stripe_event(uuid,text,boolean,text,text,bigint,jsonb) to service_role;

create function private.tbj_forget_payment_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.user_id is not null and new.user_id is null then
  new.donor_name:='';new.message:='';new.anonymous:=true;
  update public.verified_contributions set donor_name='',message='',anonymous=true,published=false where order_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.tbj_forget_payment_identity() from public,anon,authenticated;
create trigger tbj_forget_payment_identity before update on public.payment_orders for each row execute function private.tbj_forget_payment_identity();
