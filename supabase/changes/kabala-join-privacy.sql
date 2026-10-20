-- Existing read policy was SELECT true for every signed-in account; insert only
-- checked user_id. Keep the original policies and add parent-visibility guards.
create policy kabala_joins_visible_read on public.kabala_joins
as restrictive for select to authenticated
using (exists(select 1 from public.kabalot k where k.id=kabala_id));

create policy kabala_joins_visible_insert on public.kabala_joins
as restrictive for insert to authenticated
with check (exists(select 1 from public.kabalot k where k.id=kabala_id and k.joinable is true));

-- The existing client uses upsert(kabala_id,user_id). A second tap should remain
-- one membership rather than fail because UPDATE had no policy.
create policy kabala_joins_own_update on public.kabala_joins
for update to authenticated
using (user_id=auth.uid() and exists(select 1 from public.kabalot k where k.id=kabala_id and k.joinable is true))
with check (user_id=auth.uid() and exists(select 1 from public.kabalot k where k.id=kabala_id and k.joinable is true));

-- Rollback consists only of dropping these three new policies. No rows change.
