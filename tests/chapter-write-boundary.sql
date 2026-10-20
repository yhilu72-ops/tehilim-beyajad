-- Synthetic records only. Verify that clients cannot bypass the atomic RPCs.
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-write-boundary@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members)
values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic write boundary','refua_shelema','Test','private','TSTWRITEBOUND88',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
do $$declare r jsonb;begin
 begin
  insert into public.chapter_claims(room_id,user_id,chapter_number,round_number,read_mode,status)
  values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,1,1,'normal','completed');
  raise exception 'Client bypassed the reservation workflow';
 exception when insufficient_privilege then null;end;
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,1);
 if not (r->>'ok')::boolean then raise exception 'RPC reservation broken';end if;
 begin
  update public.chapter_claims set status='completed' where room_id=current_setting('test.r')::uuid;
  raise exception 'Client bypassed confirmation';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.chapter_claims where room_id=current_setting('test.r')::uuid;
  raise exception 'Client bypassed cancellation';
 exception when insufficient_privilege then null;end;
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":1,"status":"holding","is_mine":true}]' then raise exception 'Hold not preserved';end if;
 perform public.tbj_seat_confirm(current_setting('test.r')::uuid,1);
 if not exists(select 1 from public.chapter_claims where room_id=current_setting('test.r')::uuid and status='claimed') then raise exception 'Own reminder read broken';end if;
 perform public.tbj_seat_complete(current_setting('test.r')::uuid,1);
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":1,"status":"completed","is_mine":true}]' then raise exception 'RPC completion broken';end if;
 if has_table_privilege('anon','public.chapter_claims','INSERT') or has_table_privilege('authenticated','public.chapter_claims','TRUNCATE') then raise exception 'Unexpected write grants';end if;
end $$;
reset role;
select 'PASS: direct writes denied; original reserve/confirm/read RPCs and own reminders still work' as verification;
rollback;
