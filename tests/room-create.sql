begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true),set_config('test.room',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.owner')::uuid,'tbj-create-owner@example.invalid'),(current_setting('test.other')::uuid,'tbj-create-other@example.invalid');
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$declare created uuid;begin
 insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members)
 values(current_setting('test.room')::uuid,auth.uid(),'Synthetic create','refua_shelema','Test','private','TSTCREATERET88',100) returning id into created;
 if created is distinct from current_setting('test.room')::uuid then raise exception 'Creator cannot receive inserted private room';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.rooms where id=current_setting('test.room')::uuid) then raise exception 'Private room exposed to nonmember';end if;
end $$;
reset role;
select 'PASS: authenticated private room insert/returning and nonmember isolation' as verification;
rollback;
