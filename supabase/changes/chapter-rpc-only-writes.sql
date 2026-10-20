-- Before this change anon/authenticated had all table privileges. Keep SELECT
-- and its existing RLS for reminders/realtime. Only the existing postgres-owned
-- SECURITY DEFINER RPCs may perform chapter transitions. No rows or RPCs change.
revoke insert, update, delete, truncate, references, trigger
  on public.chapter_claims from anon, authenticated;

-- Emergency rollback (do not apply routinely): the prior grants were
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   ON public.chapter_claims TO anon, authenticated;
