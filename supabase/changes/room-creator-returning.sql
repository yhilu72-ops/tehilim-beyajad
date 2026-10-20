-- INSERT ... RETURNING must evaluate ownership on the candidate row itself.
-- A stable helper querying rooms cannot see a just-inserted private room yet.
alter policy rooms_access_guard on public.rooms
using (not deleted and active and (
 access_type='public' or creator_id=(select auth.uid()) or private.tbj_member(id)
));
