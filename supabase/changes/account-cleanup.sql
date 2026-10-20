-- Cleanup only callable by the authenticated server function, never by app clients.
create or replace function public.tbj_cleanup_account(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.good_wishes where user_id=p_user or room_id in(select id::text from public.rooms where creator_id=p_user);
 delete from public.kabala_joins where user_id=p_user or kabala_id in(select id from public.kabalot where user_id=p_user or room_id in(select id from public.rooms where creator_id=p_user));
 delete from public.kabalot where user_id=p_user or room_id in(select id from public.rooms where creator_id=p_user);
 delete from public.prayer_actions where requester_user_id=p_user;
 delete from public.prayer_requests where user_id=p_user;
 delete from public.room_presence where user_id=p_user or room_id in(select id from public.rooms where creator_id=p_user);
 delete from public.room_updates where created_by=p_user or room_id in(select id from public.rooms where creator_id=p_user);
 update public.mercadopago_payments set user_id=null,payer_email=null,metadata=metadata-'donor_name'-'message',raw_payment=null where user_id=p_user;
end;$$;
revoke all on function public.tbj_cleanup_account(uuid) from public,anon,authenticated;
grant execute on function public.tbj_cleanup_account(uuid) to service_role;
