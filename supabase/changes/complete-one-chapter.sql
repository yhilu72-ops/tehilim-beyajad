-- Additive endpoint: existing reservation, confirmation and Shabbat RPCs stay intact.
-- One UPDATE provides row locking and idempotency; no client-side table writes.
create or replace function public.tbj_seat_complete_chapter(
  p_room_id uuid, p_round_number integer, p_chapter_number integer,
  p_read_mode text default 'normal'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_mode text := coalesce(nullif(btrim(p_read_mode), ''), 'normal');
  v_chapter integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.tbj_can_access_room(p_room_id, v_user) then
    raise exception 'ROOM_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_chapter_number is null or p_chapter_number not between 1 and 150
    or p_round_number is null or p_round_number < 1
    or v_mode not in ('normal', 'shabbat') then
    raise exception 'INVALID_CHAPTER_CONTEXT' using errcode = '22023';
  end if;
  update public.chapter_claims
    set status = 'completed', completed_at = now(), expires_at = null
    where room_id = p_room_id and round_number = p_round_number
      and read_mode = v_mode and chapter_number = p_chapter_number
      and user_id = v_user and status = 'claimed'
    returning chapter_number into v_chapter;
  if v_chapter is not null then
    return jsonb_build_object('ok', true, 'chapter', v_chapter, 'already_completed', false);
  end if;
  if exists(select 1 from public.chapter_claims
    where room_id = p_room_id and round_number = p_round_number
      and read_mode = v_mode and chapter_number = p_chapter_number
      and user_id = v_user and status = 'completed') then
    return jsonb_build_object('ok', true, 'chapter', p_chapter_number, 'already_completed', true);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'not_claimed_by_you');
end;
$$;
revoke all on function public.tbj_seat_complete_chapter(uuid, integer, integer, text) from public, anon;
grant execute on function public.tbj_seat_complete_chapter(uuid, integer, integer, text) to authenticated;
comment on function public.tbj_seat_complete_chapter(uuid, integer, integer, text)
  is 'Marks one authenticated member-owned confirmed chapter as read; retries are idempotent.';
