create policy chapter_room_guard on public.chapter_claims as restrictive for all to authenticated using(private.tbj_member(room_id)) with check(private.tbj_member(room_id));
create policy presence_room_guard on public.room_presence as restrictive for all to authenticated using(private.tbj_member(room_id)) with check(private.tbj_member(room_id));
