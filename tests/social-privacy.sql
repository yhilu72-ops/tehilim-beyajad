begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-social-a@example.invalid'),(current_setting('test.b')::uuid,'tbj-social-b@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members)
values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic social privacy','refua_shelema','Test','private','TSTSOCIALGUARD88',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
insert into public.profiles(id,email,full_name) values(current_setting('test.a')::uuid,'private-test@example.invalid','Private synthetic name') on conflict(id) do update set full_name=excluded.full_name;
insert into public.good_wishes(room_id,user_id,message,display_name,is_anonymous) values(current_setting('test.r'),current_setting('test.a')::uuid,'Synthetic anonymous wish',null,true);
insert into public.room_updates(room_id,created_by,message) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic owner update');
insert into public.content_reports(room_id,reporter_id,description) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic confidential report');
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.profiles where id=current_setting('test.a')::uuid) then raise exception 'Other account profile exposed';end if;
 if exists(select 1 from public.good_wishes where room_id=current_setting('test.r')) then raise exception 'Private wish exposed to outsider';end if;
 if exists(select 1 from public.room_updates where room_id=current_setting('test.r')::uuid) then raise exception 'Private update exposed to outsider';end if;
 if exists(select 1 from public.content_reports where room_id=current_setting('test.r')::uuid) then raise exception 'Private report exposed';end if;
 begin
  insert into public.good_wishes(room_id,user_id,message) values(current_setting('test.r'),current_setting('test.b')::uuid,'Uninvited wish');
  raise exception 'Outsider can publish in private room';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'member');
set local role authenticated;
do $$begin
 if not exists(select 1 from public.good_wishes where room_id=current_setting('test.r') and display_name is null and is_anonymous) then raise exception 'Member cannot read anonymous wish';end if;
 if not exists(select 1 from public.room_updates where room_id=current_setting('test.r')::uuid) then raise exception 'Member cannot read update';end if;
 begin
  insert into public.room_updates(room_id,created_by,message) values(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'Unauthorized member update');
  raise exception 'Nonowner posted owner update';
 exception when insufficient_privilege then null;end;
end $$;
insert into public.blocked_users(user_id,blocked_user_id) values(current_setting('test.b')::uuid,current_setting('test.a')::uuid);
do $$begin
 if exists(select 1 from public.good_wishes where room_id=current_setting('test.r')) then raise exception 'Blocked author wish still exposed';end if;
end $$;
reset role;
select 'PASS: own profile/report isolation, private wish/update access, authenticated publishing, owner-only updates, blocked author filter' as verification;
rollback;
