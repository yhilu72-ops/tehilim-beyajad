begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.r',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.a')::uuid,'tbj-a@example.invalid'),(current_setting('test.b')::uuid,'tbj-b@example.invalid');
insert into public.rooms(id,creator_id,title,category,person_name,access_type,room_code,max_members) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'Synthetic','refua_shelema','Test','private','TSTSHABBAT88',100);
insert into public.room_members(room_id,user_id,role) values(current_setting('test.r')::uuid,current_setting('test.a')::uuid,'creator'),(current_setting('test.r')::uuid,current_setting('test.b')::uuid,'member');
insert into public.prayer_requests(user_id,category,person_name,mother_name,display_name,privacy_mode,note,is_active,device_id) values(current_setting('test.a')::uuid,'refua','Private Name','Private Mother','malicious full name','anonymous','private phone',true,'private device');
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$declare matches jsonb; r jsonb;begin
 if exists(select 1 from public.prayer_requests where user_id=current_setting('test.a')::uuid) then raise exception 'Raw prayer data leaked';end if;
 select jsonb_agg(to_jsonb(m)) into matches from public.tbj_prayer_matches('refua') m;
 if matches::text like '%Private%' or matches::text like '%private%' or matches::text like '%malicious%' then raise exception 'Anonymity leaked';end if;
 if not exists(select 1 from public.tbj_prayer_matches('refua') where display_name='Persona de Am Israel' and note='') then raise exception 'Safe match missing';end if;
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,1,'shabbat');if not (r->>'ok')::boolean then raise exception 'Reserve failed';end if;
 perform public.tbj_seat_confirm(current_setting('test.r')::uuid,1,'shabbat');
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.a'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,1,'shabbat');if (r->>'ok')::boolean then raise exception 'Duplicate chapter admitted';end if;
 r:=public.tbj_seat_list(current_setting('test.r')::uuid,1,'shabbat');if not r @> '[{"chapter_number":1,"is_mine":false,"status":"claimed"}]' then raise exception 'Other participant reservation not visible';end if;
 r:=public.tbj_seat_complete(current_setting('test.r')::uuid,1,'shabbat');if jsonb_array_length(r->'chapters')<>0 then raise exception 'Completed someone else chapter';end if;
 r:=public.tbj_seat_reserve(current_setting('test.r')::uuid,1,1,'normal');if not (r->>'ok')::boolean then raise exception 'Normal and Shabbat not independent';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.b'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.tbj_seat_complete(current_setting('test.r')::uuid,1,'shabbat');if not r->'chapters' @> '[1]' then raise exception 'Owner completion failed';end if;
 insert into public.blocked_users(user_id,blocked_user_id) values(current_setting('test.b')::uuid,current_setting('test.a')::uuid);
 if exists(select 1 from public.tbj_prayer_matches('refua')) then raise exception 'Blocked author visible';end if;
end $$;
reset role;
select 'PASS: private prayer fields, anonymous projection, blocked authors, two-user Shabbat reservation collision, ownership, completion and normal-mode separation' as verification;
rollback;
