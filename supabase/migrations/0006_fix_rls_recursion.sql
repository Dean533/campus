-- ============================================================
-- Fix: infinite recursion between sessions and session_participants RLS
--
-- The loop:
--   sessions_read_participant  → queries session_participants
--   sp_read_same_session       → queries sessions
--   → back to sessions_read_participant → infinite recursion
--
-- Fix: replace the sessions-table sub-select in sp_read_same_session
-- with a SECURITY DEFINER helper that bypasses RLS on sessions.
-- ============================================================

-- Helper: returns the tutor_id for a session without triggering RLS.
-- SECURITY DEFINER + explicit search_path prevents privilege escalation.
create or replace function public.get_session_tutor_id(p_session_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select tutor_id from public.sessions where id = p_session_id
$$;

-- Drop the recursive policy and replace it.
drop policy if exists "sp_read_same_session" on public.session_participants;

create policy "sp_read_same_session" on public.session_participants
  for select using (
    student_id = auth.uid()
    or public.get_session_tutor_id(session_id) = auth.uid()
  );
