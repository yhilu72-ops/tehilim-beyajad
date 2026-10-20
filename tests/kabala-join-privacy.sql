begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true),set_config('test.k',gen_random_uuid()::text,true),set_config('test.personal',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-kabala-a@example.invalid'),(current_setting('test.b')::uuid,'tbj-kabala-b@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members)
values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic kabala privacy','refua_shelema','Test','private','TSTKABALAGUARD88',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
insert into public.kabalot(id,room_id,user_id,text,joinable) values
(current_setting('test.k')::uuid,current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic group commitment',true),
(current_setting('test.personal')::uuid,current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic personal commitment',false)
returning id;
insert into public.kabala_joins(kabala_id,user_id) values(current_setting('test.k')::uuid,current_setting('test.a')::uuid);
insert into public.kabala_joins(kabala_id,user_id) values(current_setting('test.k')::uuid,current_setting('test.a')::uuid)
on conflict(kabala_id,user_id) do update set user_id=excluded.user_id;
do $$begin
 if (select count(*) from public.kabala_joins where kabala_id=current_setting('test.k')::uuid)<>1 then raise exception 'Repeat join duplicated membership';end if;
 begin
  insert into public.kabala_joins(kabala_id,user_id) values(current_setting('test.personal')::uuid,current_setting('test.a')::uuid);
  raise exception 'Personal commitment accepted another join';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.kabala_joins where kabala_id=current_setting('test.k')::uuid) then raise exception 'Outsider can see private commitment participants';end if;
 begin
  insert into public.kabala_joins(kabala_id,user_id) values(current_setting('test.k')::uuid,current_setting('test.b')::uuid);
  raise exception 'Outsider joined private commitment';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'member');
set local role authenticated;
insert into public.kabala_joins(kabala_id,user_id) values(current_setting('test.k')::uuid,current_setting('test.b')::uuid);
do $$declare n integer;begin
 if (select count(*) from public.kabala_joins where kabala_id=current_setting('test.k')::uuid)<>2 then raise exception 'Member count broken';end if;
 delete from public.kabalot where id=current_setting('test.k')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Member deleted another author commitment';end if;
end $$;
reset role;
select 'PASS: private kabala participants hidden from outsiders, joining requires membership and joinable parent, repeated join stays unique' as verification;
rollback;
