-- Runs against the existing atomic RPCs; all synthetic records roll back.
begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-lifecycle-a@example.invalid'),(current_setting('test.b')::uuid,'tbj-lifecycle-b@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic lifecycle','refua_shelema','Test','private','TSTLIFECYCLE88',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator'),(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'member');
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,1);
 if not (r->>'ok')::boolean or (r->>'status')<>'holding' then raise exception 'Initial reservation failed';end if;
 if abs(extract(epoch from ((r->>'expires_at')::timestamptz-now()))-180)>1 then raise exception 'Default hold is not three minutes';end if;
 r:=public.tbj_seat_release(current_setting('test.r')::uuid,1,1);
 if (r->>'released')::integer<>1 then raise exception 'Own cancellation failed';end if;
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if jsonb_array_length(r)<>0 then raise exception 'Cancelled seat persisted';end if;
 perform public.tbj_seat_reserve(current_setting('test.r')::uuid,1,2);
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_release(current_setting('test.r')::uuid,1,2);
 if (r->>'released')::integer<>0 then raise exception 'Cancelled another user reservation';end if;
 perform public.tbj_seat_confirm(current_setting('test.r')::uuid,1);
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":2,"status":"holding","is_mine":false}]' then raise exception 'Another user confirmed reservation';end if;
end $$;
reset role;
update public.chapter_claims set expires_at=now()-interval '1 second' where room_id=current_setting('test.r')::uuid;
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,2);
 if not (r->>'ok')::boolean then raise exception 'Expired reservation unavailable';end if;
 perform public.tbj_seat_confirm(current_setting('test.r')::uuid,1);
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":2,"status":"claimed","is_mine":true}]' then raise exception 'Confirmed state did not persist';end if;
 perform public.tbj_seat_complete(current_setting('test.r')::uuid,1);
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1);
 if not r @> '[{"chapter_number":2,"status":"completed","is_mine":true}]' then raise exception 'Read state did not persist';end if;
 begin
  perform public.start_next_tehilim_round(current_setting('test.r')::uuid);
  raise exception 'Premature next round allowed';
 exception when raise_exception then
  if sqlerrm='Premature next round allowed' then raise;end if;
 end;
end $$;
reset role;
insert into public.chapter_claims(room_id,user_id,chapter_number,round_number,read_mode,status)
select current_setting('test.r')::uuid,current_setting('test.b')::uuid,n,1,'normal','completed' from generate_series(1,150)n where n<>2;
set local role authenticated;
select public.start_next_tehilim_round(current_setting('test.r')::uuid);
do $$begin
 if not exists(select 1 from public.rooms where id=current_setting('test.r')::uuid and current_round=2 and completed_rounds=1) then raise exception 'Round totals incorrect';end if;
 if jsonb_array_length(public.tbj_seat_list(current_setting('test.r')::uuid,2))<>0 then raise exception 'Next round not empty';end if;
end $$;
reset role;
select 'PASS: three-minute holds, own cancellation, other-user denial, expiry, persisted confirmation/completion and next round totals' as verification;
rollback;
