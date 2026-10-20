begin;
create schema if not exists private;
grant usage on schema private to authenticated, anon;
create or replace function private.tbj_member(p_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.rooms r where r.id=p_room and not r.deleted and r.active and (r.creator_id=auth.uid() or exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=auth.uid())));
$$;
revoke all on function private.tbj_member(uuid) from public;
grant execute on function private.tbj_member(uuid) to authenticated,anon;
create policy rooms_access_guard on public.rooms as restrictive for select to anon,authenticated using(not deleted and active and (access_type='public' or private.tbj_member(id)));
-- All new memberships go through a locked capacity check. The creator can still add themselves.
create policy room_members_insert_creator on public.room_members as restrictive for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.rooms r where r.id=room_id and r.creator_id=auth.uid()));
create or replace function private.tbj_join(p_room uuid,p_code text) returns public.rooms
language plpgsql security definer set search_path='' as $$
declare r public.rooms; u uuid:=auth.uid(); n integer;
begin
 if u is null then raise exception 'Inicia sesión para entrar a una sala' using errcode='42501'; end if;
 if p_room is null and nullif(trim(p_code),'') is null then raise exception 'Falta el código de invitación'; end if;
 select * into r from public.rooms where (id=p_room or (p_room is null and room_code=upper(trim(p_code)))) and not deleted and active for update;
 if r.id is null then raise exception 'Sala no disponible';end if;
 if r.access_type<>'public' and r.creator_id<>u and not exists(select 1 from public.room_members where room_id=r.id and user_id=u) and r.room_code is distinct from upper(trim(p_code)) then raise exception 'Necesitas el código de invitación' using errcode='42501';end if;
 if not exists(select 1 from public.room_members where room_id=r.id and user_id=u) then
  select count(*) into n from public.room_members where room_id=r.id;
  if n>=r.max_members and r.creator_id<>u then raise exception 'La sala alcanzó su cupo';end if;
  insert into public.room_members(room_id,user_id,role) values(r.id,u,case when r.creator_id=u then 'creator' else 'member' end);
 end if;
 return r;
end;$$;
revoke all on function private.tbj_join(uuid,text) from public;
grant execute on function private.tbj_join(uuid,text) to authenticated;
create or replace function public.tbj_join_room(p_room uuid default null,p_code text default null) returns public.rooms
language sql security invoker set search_path='' as $$select private.tbj_join(p_room,p_code);$$;
revoke all on function public.tbj_join_room(uuid,text) from public,anon;
grant execute on function public.tbj_join_room(uuid,text) to authenticated;
-- Remove permissive historical policies that exposed private room messages.
create policy wishes_member_read on public.good_wishes as restrictive for select to anon,authenticated using(exists(select 1 from public.rooms r where r.id::text=room_id and private.tbj_member(r.id)));
create policy wishes_member_insert on public.good_wishes as restrictive for insert to anon,authenticated with check(user_id=auth.uid() and exists(select 1 from public.rooms r where r.id::text=room_id and private.tbj_member(r.id)));
create policy kabalot_member_read on public.kabalot as restrictive for select to anon,authenticated using(private.tbj_member(room_id));
create policy kabalot_member_insert on public.kabalot as restrictive for insert to anon,authenticated with check(user_id=auth.uid() and private.tbj_member(room_id));
create table if not exists public.room_contributions(
 payment_id uuid primary key references public.mercadopago_payments(id) on delete cascade,
 room_id uuid not null references public.rooms(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 donor_name text not null default '', message text not null default '',
 anonymous boolean not null default false, plan text not null, created_at timestamptz not null default now(), published boolean not null default true
);
alter table public.room_contributions enable row level security;
grant select on public.room_contributions to authenticated;
grant all on public.room_contributions to service_role;
create policy contributions_read_members on public.room_contributions for select to authenticated using(published and private.tbj_member(room_id));
create or replace function private.publish_verified_contribution() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and new.metadata->>'environment'='production' and new.room_id is not null and exists(select 1 from public.rooms where id::text=new.room_id and not deleted) then
  insert into public.room_contributions(payment_id,room_id,user_id,donor_name,message,anonymous,plan,published)
  values(new.id,new.room_id::uuid,new.user_id,case when coalesce((new.metadata->>'anonymous')::boolean,false) then '' else left(coalesce(new.metadata->>'donor_name',''),100) end,left(coalesce(new.metadata->>'message',''),500),coalesce((new.metadata->>'anonymous')::boolean,false),new.plan,true)
  on conflict(payment_id) do update set donor_name=excluded.donor_name,message=excluded.message,anonymous=excluded.anonymous,plan=excluded.plan,published=true;
 else
  update public.room_contributions set published=false where payment_id=new.id;
 end if;
 return new;
end;$$;
revoke all on function private.publish_verified_contribution() from public;
create trigger publish_verified_contribution after insert or update on public.mercadopago_payments for each row execute function private.publish_verified_contribution();
-- Reports remain private to their reporter and the service operator.
create table public.content_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id) on delete cascade,room_id uuid references public.rooms(id) on delete set null,description text not null check(length(description) between 5 and 2000),created_at timestamptz not null default now(),status text not null default 'pending');
alter table public.content_reports enable row level security;
grant select,insert on public.content_reports to authenticated;
grant all on public.content_reports to service_role;
create policy reports_own_read on public.content_reports for select to authenticated using(reporter_id=auth.uid());
create policy reports_own_insert on public.content_reports for insert to authenticated with check(reporter_id=auth.uid() and (room_id is null or private.tbj_member(room_id)));
create table public.blocked_users(user_id uuid not null references auth.users(id) on delete cascade,blocked_user_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,blocked_user_id),check(user_id<>blocked_user_id));
alter table public.blocked_users enable row level security;
grant select,insert,delete on public.blocked_users to authenticated;
grant all on public.blocked_users to service_role;
create policy blocked_users_own on public.blocked_users for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy wishes_blocked_filter on public.good_wishes as restrictive for select to authenticated using(not exists(select 1 from public.blocked_users b where b.user_id=auth.uid() and b.blocked_user_id=good_wishes.user_id));
create policy kabalot_blocked_filter on public.kabalot as restrictive for select to authenticated using(not exists(select 1 from public.blocked_users b where b.user_id=auth.uid() and b.blocked_user_id=kabalot.user_id));
create policy prayers_blocked_filter on public.prayer_requests as restrictive for select to authenticated using(not exists(select 1 from public.blocked_users b where b.user_id=auth.uid() and b.blocked_user_id=prayer_requests.user_id));
commit;
