-- The client upserts only these two columns. RLS still requires the same user
-- and a visible, joinable parent. Do not grant timestamp/id updates.
grant update(kabala_id,user_id) on public.kabala_joins to authenticated;
