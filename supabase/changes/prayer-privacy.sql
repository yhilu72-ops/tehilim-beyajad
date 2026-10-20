begin;
-- Raw names, device IDs and account IDs are visible only to their author.
create policy prayer_raw_owner_guard on public.prayer_requests as restrictive for select to anon,authenticated using(user_id=auth.uid());
create or replace function private.tbj_prayer_matches(p_category text)
returns table(id uuid,category text,display_name text,note text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión para continuar' using errcode='42501';end if;
 return query select p.id,p.category,
 case p.privacy_mode
 when 'full' then trim(p.person_name||case when nullif(trim(p.mother_name),'') is not null then ' ben/bat '||p.mother_name else '' end)
 when 'initials' then left(trim(p.person_name),1)||'.'||case when nullif(trim(p.mother_name),'') is not null then ' ben/bat '||left(trim(p.mother_name),1)||'.' else '' end
 else 'Persona de Am Israel' end,
 case when p.privacy_mode='full' then coalesce(p.note,'') else '' end
 from public.prayer_requests p
 where p.is_active and p.category=p_category and p.user_id<>auth.uid()
 and not exists(select 1 from public.blocked_users b where b.user_id=auth.uid() and b.blocked_user_id=p.user_id)
 order by p.created_at desc limit 30;
end;$$;
revoke all on function private.tbj_prayer_matches(text) from public,anon;
grant execute on function private.tbj_prayer_matches(text) to authenticated;
create or replace function public.tbj_prayer_matches(p_category text)
returns table(id uuid,category text,display_name text,note text)
language sql stable security invoker set search_path='' as $$select * from private.tbj_prayer_matches(p_category);$$;
revoke all on function public.tbj_prayer_matches(text) from public,anon;
grant execute on function public.tbj_prayer_matches(text) to authenticated;
commit;
