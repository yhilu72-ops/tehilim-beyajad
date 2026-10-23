-- Synthetic users and room; never modifies persistent user data.
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.c',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-reader-a@example.invalid'),(current_setting('test.b')::uuid,'tbj-reader-b@example.invalid'),(current_setting('test.c')::uuid,'tbj-reader-c@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic reader','refua_shelema','Test','private','TSTREADER23',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator'),(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'member');
insert into public.chapter_claims(room_id,user_id,chapter_number,round_number,read_mode,status)
values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,1,1,'normal','claimed'),
 (current_setting('test.r')::uuid,current_setting('test.a')::uuid,2,1,'normal','claimed'),
 (current_setting('test.r')::uuid,current_setting('test.a')::uuid,3,1,'normal','holding'),
 (current_setting('test.r')::uuid,current_setting('test.a')::uuid,1,1,'shabbat','claimed'),
 (current_setting('test.r')::uuid,current_setting('test.b')::uuid,4,1,'normal','claimed');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,1);
 if r->>'ok'<>'true' or r->>'already_completed'<>'false' then raise exception 'Own chapter not completed';end if;
 r:=public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,1);
 if r->>'already_completed'<>'true' then raise exception 'Retry not idempotent';end if;
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":1,"status":"completed","is_mine":true},{"chapter_number":2,"status":"claimed","is_mine":true}]' then raise exception 'Individual completion changed other chapters';end if;
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1,'shabbat');
 if not r @> '[{"chapter_number":1,"status":"claimed"}]' then raise exception 'Normal completion changed Shabbat';end if;
 if public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,4)->>'ok'<>'false' then raise exception 'Other owner chapter completed';end if;
 if public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,3)->>'ok'<>'false' then raise exception 'Holding chapter completed';end if;
 if public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,2,2)->>'ok'<>'false' then raise exception 'Wrong round completed';end if;
 begin
  perform public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,151);
  raise exception 'Invalid chapter accepted';
 exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.c'),true);
set local role authenticated;
do $$begin
 begin
  perform public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,2);
  raise exception 'Nonmember accepted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin
  perform public.tbj_seat_complete_chapter(current_setting('test.r')::uuid,1,2);
  raise exception 'Anonymous execution accepted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 if (select count(*) from public.chapter_claims where room_id=current_setting('test.r')::uuid and status='completed')<>1 then raise exception 'Unexpected completed count';end if;
 if not exists(select 1 from public.chapter_claims where room_id=current_setting('test.r')::uuid and chapter_number=1 and read_mode='normal' and completed_at is not null) then raise exception 'Missing completion timestamp';end if;
end $$;
select 'PASS: single completion, idempotent retry, other chapter/owner/round/mode isolation, hold denial, input validation, private room and anonymous denial' as verification;
rollback;
