-- Serialize conflicting provider updates using PostgreSQL's row update lock.
-- Keep provider identity immutable once assigned; ignore stale provider snapshots.
create or replace function private.tbj_guard_payment_update()
returns trigger language plpgsql set search_path = '' as $$
declare old_time timestamptz; new_time timestamptz;
begin
 if old.provider_payment_id is not null and new.provider_payment_id is distinct from old.provider_payment_id then
  raise exception 'Payment provider identity cannot be reassigned' using errcode='23505';
 end if;
 if old.raw_payment->>'date_last_updated' is not null and new.raw_payment->>'date_last_updated' is not null then
  begin
   old_time := (old.raw_payment->>'date_last_updated')::timestamptz;
   new_time := (new.raw_payment->>'date_last_updated')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
   raise exception 'Invalid provider update timestamp' using errcode='22007';
  end;
  if new_time < old_time then return null; end if;
 end if;
 return new;
end $$;
revoke all on function private.tbj_guard_payment_update() from public,anon,authenticated;
drop trigger if exists tbj_guard_payment_update on public.mercadopago_payments;
create trigger tbj_guard_payment_update before update on public.mercadopago_payments
for each row execute function private.tbj_guard_payment_update();
