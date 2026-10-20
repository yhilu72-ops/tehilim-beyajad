-- Only the server role can perform account cleanup. No client privileges change.
grant select on public.rooms to service_role;
grant select,delete on public.good_wishes,public.kabala_joins,public.kabalot,public.prayer_actions,public.prayer_requests,public.room_presence,public.room_updates to service_role;
grant select,update on public.mercadopago_payments to service_role;
