-- ============================================================
-- Campus RLS Migration 0002
-- Run AFTER 0001_schema.sql
-- ============================================================

-- Enable RLS on every table
alter table public.schools                enable row level security;
alter table public.profiles               enable row level security;
alter table public.professors             enable row level security;
alter table public.courses                enable row level security;
alter table public.course_offerings       enable row level security;
alter table public.enrollments            enable row level security;
alter table public.verification_requests  enable row level security;
alter table public.verified_tutors        enable row level security;
alter table public.notifications          enable row level security;
alter table public.questions              enable row level security;
alter table public.answers                enable row level security;
alter table public.answer_likes           enable row level security;
alter table public.session_requests       enable row level security;
alter table public.sessions               enable row level security;
alter table public.session_participants   enable row level security;
alter table public.session_ratings        enable row level security;
alter table public.materials              enable row level security;
alter table public.material_purchases     enable row level security;
alter table public.material_ratings       enable row level security;
alter table public.professor_ratings      enable row level security;
alter table public.professor_rating_stats enable row level security;
alter table public.study_groups           enable row level security;
alter table public.study_group_members    enable row level security;
alter table public.study_group_files      enable row level security;
alter table public.study_group_sessions   enable row level security;
alter table public.payment_transactions   enable row level security;
alter table public.subscriptions          enable row level security;

-- ============================================================
-- Helper functions
-- ============================================================

-- Returns the current user's school_id without triggering RLS on profiles.
-- SECURITY DEFINER bypasses RLS, so this does not cause infinite recursion
-- when used inside other RLS policies.
create or replace function public.my_school_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ============================================================
-- schools (public read, no client writes)
-- ============================================================
create policy "schools_read" on public.schools
  for select using (auth.uid() is not null);

-- ============================================================
-- profiles
-- ============================================================
-- Allow any authenticated user to read any profile.
-- (Keeping this simple for a prototype; per-school filtering
-- is enforced on content tables like questions.)
create policy "profiles_read" on public.profiles
  for select using (auth.uid() is not null);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Insert is handled by the handle_new_user trigger (SECURITY DEFINER).
-- No direct client INSERT policy needed.

-- ============================================================
-- professors / courses / course_offerings (public read, no client writes)
-- ============================================================
create policy "professors_read" on public.professors
  for select using (auth.uid() is not null);

create policy "courses_read" on public.courses
  for select using (auth.uid() is not null);

create policy "offerings_read" on public.course_offerings
  for select using (auth.uid() is not null);

-- ============================================================
-- enrollments
-- ============================================================
create policy "enrollments_read" on public.enrollments
  for select using (auth.uid() is not null);

create policy "enrollments_insert_own" on public.enrollments
  for insert with check (user_id = auth.uid());

create policy "enrollments_delete_own" on public.enrollments
  for delete using (user_id = auth.uid());

-- ============================================================
-- verification_requests
-- RISK: admin UPDATE policy is critical. Ensure admin actions
-- always use the service role key in Server Actions, not anon key.
-- ============================================================
create policy "vr_read_own_or_admin" on public.verification_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "vr_insert_own" on public.verification_requests
  for insert with check (user_id = auth.uid());

create policy "vr_update_admin_only" on public.verification_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- verified_tutors
-- RISK: no client INSERT/UPDATE/DELETE. Only the trigger (SECURITY DEFINER)
-- can write here. Test this by attempting a direct INSERT from the anon key
-- and confirming it fails.
-- ============================================================
create policy "vt_read_authenticated" on public.verified_tutors
  for select using (auth.uid() is not null);

-- No INSERT / UPDATE / DELETE policies. Trigger writes via SECURITY DEFINER.

-- ============================================================
-- notifications (own only)
-- ============================================================
create policy "notif_read_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notif_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- ============================================================
-- questions (per-school, using denormalized school_id)
-- ============================================================
create policy "questions_read_same_school" on public.questions
  for select using (school_id = public.my_school_id());

create policy "questions_insert_own" on public.questions
  for insert with check (
    author_id = auth.uid()
    and school_id = public.my_school_id()
  );

create policy "questions_update_own" on public.questions
  for update using (author_id = auth.uid());

create policy "questions_delete_own_or_admin" on public.questions
  for delete using (author_id = auth.uid() or public.is_admin());

-- ============================================================
-- answers
-- ============================================================
create policy "answers_read" on public.answers
  for select using (
    exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.school_id = public.my_school_id()
    )
  );

create policy "answers_insert_authenticated" on public.answers
  for insert with check (author_id = auth.uid());

create policy "answers_update_own" on public.answers
  for update using (author_id = auth.uid());

create policy "answers_delete_own_or_admin" on public.answers
  for delete using (author_id = auth.uid() or public.is_admin());

-- ============================================================
-- answer_likes
-- ============================================================
create policy "likes_read" on public.answer_likes
  for select using (auth.uid() is not null);

create policy "likes_insert_own" on public.answer_likes
  for insert with check (user_id = auth.uid());

create policy "likes_delete_own" on public.answer_likes
  for delete using (user_id = auth.uid());

-- ============================================================
-- session_requests (per-school)
-- ============================================================
create policy "sr_read_school" on public.session_requests
  for select using (
    school_id = public.my_school_id()
    and (
      student_id = auth.uid()
      or status = 'open'
      or exists (select 1 from public.verified_tutors where user_id = auth.uid())
    )
  );

create policy "sr_insert_own" on public.session_requests
  for insert with check (
    student_id = auth.uid()
    and school_id = public.my_school_id()
  );

create policy "sr_update_own_open" on public.session_requests
  for update using (student_id = auth.uid() and status = 'open');

-- ============================================================
-- sessions
-- RISK: no direct client INSERT. Only claim_session_request RPC (SECURITY DEFINER) writes here.
-- ============================================================
create policy "sessions_read_participant" on public.sessions
  for select using (
    tutor_id = auth.uid()
    or exists (
      select 1 from public.session_participants
      where session_id = id and student_id = auth.uid()
    )
  );

-- ============================================================
-- session_participants
-- ============================================================
create policy "sp_read_same_session" on public.session_participants
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and s.tutor_id = auth.uid()
    )
  );

-- ============================================================
-- session_ratings
-- ============================================================
create policy "srat_read" on public.session_ratings
  for select using (auth.uid() is not null);

create policy "srat_insert_participant" on public.session_ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.session_participants
      where session_id = session_ratings.session_id
        and student_id = auth.uid()
    )
  );

create policy "srat_update_own" on public.session_ratings
  for update using (rater_id = auth.uid());

-- ============================================================
-- materials (per-school)
-- RISK: file download access controlled by Server Action + get_material_download_url RPC.
-- The materials bucket in Storage has no direct SELECT policy for clients.
-- ============================================================
create policy "mat_read_same_school" on public.materials
  for select using (school_id = public.my_school_id());

create policy "mat_insert_verified_tutor" on public.materials
  for insert with check (
    uploader_id = auth.uid()
    and school_id = public.my_school_id()
    and exists (
      select 1 from public.verified_tutors vt
      join public.course_offerings co on co.id = materials.offering_id
      where vt.user_id = auth.uid()
        and vt.course_id = co.course_id
    )
  );

create policy "mat_update_own" on public.materials
  for update using (uploader_id = auth.uid());

-- ============================================================
-- material_purchases
-- ============================================================
create policy "mp_read_own" on public.material_purchases
  for select using (buyer_id = auth.uid());

create policy "mp_insert_own" on public.material_purchases
  for insert with check (
    buyer_id = auth.uid()
    and material_id not in (
      select id from public.materials where uploader_id = auth.uid()
    )
  );

-- ============================================================
-- material_ratings (post-purchase only)
-- ============================================================
create policy "mrat_read" on public.material_ratings
  for select using (auth.uid() is not null);

create policy "mrat_insert_purchased" on public.material_ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.material_purchases
      where material_id = material_ratings.material_id
        and buyer_id = auth.uid()
    )
  );

create policy "mrat_update_own" on public.material_ratings
  for update using (rater_id = auth.uid());

-- ============================================================
-- professor_ratings
-- ============================================================
create policy "pr_read" on public.professor_ratings
  for select using (auth.uid() is not null);

create policy "pr_insert_enrolled" on public.professor_ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.enrollments
      where user_id = auth.uid()
        and offering_id = professor_ratings.offering_id
    )
  );

create policy "pr_update_own" on public.professor_ratings
  for update using (rater_id = auth.uid());

-- ============================================================
-- professor_rating_stats (trigger only writes, public read)
-- ============================================================
create policy "prs_read" on public.professor_rating_stats
  for select using (auth.uid() is not null);

-- ============================================================
-- study_groups
-- ============================================================
create policy "sg_read_public_or_member" on public.study_groups
  for select using (
    not is_private
    or exists (
      select 1 from public.study_group_members
      where group_id = id and user_id = auth.uid()
    )
  );

create policy "sg_insert_enrolled" on public.study_groups
  for insert with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and offering_id = study_groups.offering_id
    )
  );

create policy "sg_update_admin" on public.study_groups
  for update using (
    exists (
      select 1 from public.study_group_members
      where group_id = id and user_id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- study_group_members
-- ============================================================
create policy "sgm_read_members" on public.study_group_members
  for select using (
    exists (
      select 1 from public.study_group_members sgm2
      where sgm2.group_id = study_group_members.group_id
        and sgm2.user_id = auth.uid()
    )
  );

create policy "sgm_insert_own" on public.study_group_members
  for insert with check (user_id = auth.uid());

create policy "sgm_delete_own" on public.study_group_members
  for delete using (user_id = auth.uid());

-- ============================================================
-- study_group_files / study_group_sessions (members only)
-- ============================================================
create policy "sgf_read_members" on public.study_group_files
  for select using (
    exists (
      select 1 from public.study_group_members
      where group_id = study_group_files.group_id and user_id = auth.uid()
    )
  );

create policy "sgf_insert_members" on public.study_group_files
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.study_group_members
      where group_id = study_group_files.group_id and user_id = auth.uid()
    )
  );

create policy "sgs_read_members" on public.study_group_sessions
  for select using (
    exists (
      select 1 from public.study_group_members
      where group_id = study_group_sessions.group_id and user_id = auth.uid()
    )
  );

create policy "sgs_insert_members" on public.study_group_sessions
  for insert with check (
    organizer_id = auth.uid()
    and exists (
      select 1 from public.study_group_members
      where group_id = study_group_sessions.group_id and user_id = auth.uid()
    )
  );

-- ============================================================
-- payment_transactions / subscriptions (own only, no client writes)
-- ============================================================
create policy "pt_read_own" on public.payment_transactions
  for select using (user_id = auth.uid());

create policy "sub_read_own" on public.subscriptions
  for select using (user_id = auth.uid());
