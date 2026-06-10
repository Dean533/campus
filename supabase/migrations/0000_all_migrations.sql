-- ============================================================
-- Campus Schema Migration 0001
-- Run in Supabase SQL Editor in this order: 0001, 0002, 0003, 0004, 0005
-- ============================================================

-- ---- Core reference tables ----

create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  domain     text not null unique,
  state      text,
  logo_url   text,
  created_at timestamptz not null default now()
);

-- Profiles extends auth.users 1-to-1.
-- school_id is nullable so the trigger can set it from email domain;
-- if domain is not yet seeded the user still gets a profile and picks school during onboarding.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  school_id           uuid references public.schools(id),
  display_name        text not null default '',
  avatar_url          text,
  bio                 text,
  major               text,
  graduation_year     smallint,
  reputation_points   integer not null default 0,
  tier                text not null default 'Bronze' check (tier in ('Bronze','Silver','Gold')),
  is_admin            boolean not null default false,
  onboarding_complete boolean not null default false,
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.professors (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  first_name text not null,
  last_name  text not null,
  department text,
  created_at timestamptz not null default now(),
  unique (school_id, first_name, last_name)
);

create table if not exists public.courses (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id),
  code       text not null,
  title      text not null,
  department text,
  credits    smallint,
  created_at timestamptz not null default now(),
  unique (school_id, code)
);

-- A course_offering = one instance of a course in a specific semester with a specific professor.
-- This is the central entity that ties everything together.
create table if not exists public.course_offerings (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  professor_id uuid references public.professors(id) on delete set null,
  semester     text not null,
  year         smallint not null,
  is_current   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (course_id, professor_id, semester, year)
);

create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (user_id, offering_id)
);

-- Verification is COURSE-LEVEL (not offering-level).
-- offering_id is stored for evidence tracing.
-- course_id is denormalized so the trigger can write to verified_tutors without a join.
create table if not exists public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  offering_id   uuid not null references public.course_offerings(id),
  course_id     uuid not null references public.courses(id),
  grade_claimed text not null check (grade_claimed in ('A+','A','A-','B+')),
  file_path     text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes   text,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  unique (user_id, course_id)
);

-- Populated only by the handle_verification_approval trigger.
-- Clients can never insert directly (enforced by RLS).
create table if not exists public.verified_tutors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  course_id    uuid not null references public.courses(id),
  grade_earned text not null,
  verified_at  timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  action_url text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---- Pillar 1: Feed ----

-- school_id is denormalized here for fast per-school RLS without multi-table joins.
create table if not exists public.questions (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references public.profiles(id) on delete cascade,
  offering_id        uuid not null references public.course_offerings(id),
  school_id          uuid not null references public.schools(id),
  title              text not null,
  body               text not null,
  view_count         integer not null default 0,
  answer_count       integer not null default 0,
  accepted_answer_id uuid,
  is_resolved        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  like_count  integer not null default 0,
  is_accepted boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.questions
  add constraint fk_accepted_answer
  foreign key (accepted_answer_id) references public.answers(id) on delete set null
  deferrable initially deferred;

create table if not exists public.answer_likes (
  id         uuid primary key default gen_random_uuid(),
  answer_id  uuid not null references public.answers(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

-- ---- Pillar 2: Book a Brain ----

create table if not exists public.session_requests (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  offering_id      uuid not null references public.course_offerings(id),
  school_id        uuid not null references public.schools(id),
  description      text not null,
  session_type     text not null check (session_type in ('emergency','scheduled')),
  urgency_note     text,
  proposed_at      timestamptz,
  duration_minutes smallint not null default 60,
  format           text not null default '1on1' check (format in ('1on1','group')),
  max_students     smallint not null default 1,
  price_display    numeric(6,2) not null default 0,
  status           text not null default 'open' check (status in ('open','matched','expired','cancelled')),
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.sessions (
  id                        uuid primary key default gen_random_uuid(),
  request_id                uuid references public.session_requests(id),
  tutor_id                  uuid not null references public.profiles(id),
  offering_id               uuid not null references public.course_offerings(id),
  format                    text not null check (format in ('1on1','group')),
  max_students              smallint not null default 1,
  status                    text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  scheduled_at              timestamptz not null,
  duration_minutes          smallint not null default 60,
  price_per_student_display numeric(6,2) not null default 0,
  prep_note                 text,
  meet_url                  text,
  surge_multiplier          numeric(4,2) not null default 1.0,
  created_at                timestamptz not null default now()
);

create table if not exists public.session_participants (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  student_id     uuid not null references public.profiles(id),
  payment_status text not null default 'simulated' check (payment_status in ('simulated','paid','refunded')),
  joined_at      timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.session_ratings (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id),
  rater_id      uuid not null references public.profiles(id),
  rated_user_id uuid not null references public.profiles(id),
  stars         smallint not null check (stars between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  unique (session_id, rater_id)
);

-- ---- Pillar 3: Study Vault ----

create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  uploader_id     uuid not null references public.profiles(id) on delete cascade,
  offering_id     uuid not null references public.course_offerings(id),
  school_id       uuid not null references public.schools(id),
  title           text not null,
  description     text,
  material_type   text not null check (material_type in ('flashcards','notes','concept_map','practice_problems','cheat_sheet')),
  file_path       text not null,
  file_type       text not null,
  file_size_bytes bigint,
  price_display   numeric(6,2) not null default 0,
  is_free         boolean not null default false,
  semester        text,
  year            smallint,
  grade_earned    text,
  download_count  integer not null default 0,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    integer not null default 0,
  is_published    boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.material_purchases (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references public.materials(id) on delete cascade,
  buyer_id       uuid not null references public.profiles(id) on delete cascade,
  amount_display numeric(6,2) not null default 0,
  purchased_at   timestamptz not null default now(),
  unique (material_id, buyer_id)
);

create table if not exists public.material_ratings (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  rater_id    uuid not null references public.profiles(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (material_id, rater_id)
);

-- ---- Pillar 4: Prof Pulse ----

create table if not exists public.professor_ratings (
  id                 uuid primary key default gen_random_uuid(),
  professor_id       uuid not null references public.professors(id) on delete cascade,
  rater_id           uuid not null references public.profiles(id) on delete cascade,
  offering_id        uuid not null references public.course_offerings(id),
  exam_fairness      smallint not null check (exam_fairness between 1 and 5),
  grade_transparency smallint not null check (grade_transparency between 1 and 5),
  lecture_quality    smallint not null check (lecture_quality between 1 and 5),
  office_hours_value smallint not null check (office_hours_value between 1 and 5),
  curve_likelihood   smallint not null check (curve_likelihood between 1 and 5),
  curve_magnitude    smallint not null check (curve_magnitude between 1 and 5),
  workload_realism   smallint not null check (workload_realism between 1 and 5),
  comment            text,
  would_retake       boolean,
  grade_received     text,
  created_at         timestamptz not null default now(),
  unique (professor_id, rater_id, offering_id)
);

create table if not exists public.professor_rating_stats (
  professor_id           uuid primary key references public.professors(id) on delete cascade,
  rating_count           integer not null default 0,
  avg_exam_fairness      numeric(3,2) not null default 0,
  avg_grade_transparency numeric(3,2) not null default 0,
  avg_lecture_quality    numeric(3,2) not null default 0,
  avg_office_hours_value numeric(3,2) not null default 0,
  avg_curve_likelihood   numeric(3,2) not null default 0,
  avg_curve_magnitude    numeric(3,2) not null default 0,
  avg_workload_realism   numeric(3,2) not null default 0,
  overall_avg            numeric(3,2) not null default 0,
  estimated_gpa_low      numeric(3,2) not null default 0,
  estimated_gpa_high     numeric(3,2) not null default 0,
  would_retake_pct       numeric(5,2) not null default 0,
  updated_at             timestamptz not null default now()
);

-- ---- Pillar 5: Class Graph ----

create table if not exists public.study_groups (
  id          uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  creator_id  uuid not null references public.profiles(id),
  name        text not null,
  description text,
  max_members smallint not null default 8,
  is_private  boolean not null default false,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

create table if not exists public.study_group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.study_groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.study_group_files (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.study_groups(id) on delete cascade,
  uploader_id     uuid not null references public.profiles(id),
  file_name       text not null,
  file_path       text not null,
  file_size_bytes bigint,
  uploaded_at     timestamptz not null default now()
);

create table if not exists public.study_group_sessions (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.study_groups(id) on delete cascade,
  organizer_id     uuid not null references public.profiles(id),
  title            text not null,
  scheduled_at     timestamptz not null,
  duration_minutes smallint not null default 90,
  meet_url         text,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---- Payment stubs (empty in v1, columns ready for Stripe) ----

create table if not exists public.payment_transactions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id),
  transaction_type         text not null check (transaction_type in ('purchase','payout','subscription')),
  amount                   numeric(8,2) not null,
  currency                 text not null default 'usd',
  status                   text not null default 'simulated' check (status in ('simulated','pending','completed','failed','refunded')),
  stripe_payment_intent_id text,
  stripe_transfer_id       text,
  reference_type           text,
  reference_id             uuid,
  created_at               timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id),
  plan                   text not null default 'free' check (plan in ('free','pro')),
  status                 text not null default 'active',
  stripe_subscription_id text,
  period_start           timestamptz,
  period_end             timestamptz,
  created_at             timestamptz not null default now()
);
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
-- ============================================================
-- Campus Triggers Migration 0003
-- Run AFTER 0002_rls.sql
-- ============================================================

-- ============================================================
-- 1. handle_new_user
-- Creates a profile row when a new auth user signs up.
-- Sets school_id from email domain if a matching school exists.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_school_id uuid;
  v_domain    text;
  v_name      text;
begin
  v_domain := split_part(new.email, '@', 2);

  select id into v_school_id
  from public.schools
  where domain = v_domain;

  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, school_id, display_name)
  values (new.id, v_school_id, v_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. handle_verification_approval
-- When admin sets verification_requests.status = 'approved',
-- this trigger writes to verified_tutors and awards reputation.
-- Uses BEFORE UPDATE so it can set reviewed_at on the same row.
-- ============================================================
create or replace function public.handle_verification_approval()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status <> 'approved' and new.status = 'approved' then
    insert into public.verified_tutors (user_id, course_id, grade_earned)
    values (new.user_id, new.course_id, new.grade_claimed)
    on conflict (user_id, course_id) do update
      set grade_earned = excluded.grade_earned,
          verified_at  = now();

    update public.profiles
    set reputation_points = reputation_points + 200
    where id = new.user_id;

    new.reviewed_at := now();

    insert into public.notifications (user_id, type, title, body, action_url)
    values (
      new.user_id,
      'verification_approved',
      'You are now a verified tutor!',
      'Your grade was verified. You can now accept sessions and upload study materials.',
      '/profile'
    );
  end if;

  return new;
end;
$$;

create trigger on_verification_status_change
  before update on public.verification_requests
  for each row execute function public.handle_verification_approval();

-- ============================================================
-- 3. handle_answer_like_count
-- Maintains the denormalized like_count on answers.
-- Also awards rep points to the answer author.
-- ============================================================
create or replace function public.handle_answer_like_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.answers
    set like_count = like_count + 1
    where id = new.answer_id;

    update public.profiles p
    set reputation_points = reputation_points + 3
    from public.answers a
    where a.id = new.answer_id
      and p.id = a.author_id
      and p.id <> new.user_id;

  elsif TG_OP = 'DELETE' then
    update public.answers
    set like_count = greatest(0, like_count - 1)
    where id = old.answer_id;
  end if;

  return null;
end;
$$;

create trigger on_answer_like
  after insert or delete on public.answer_likes
  for each row execute function public.handle_answer_like_count();

-- ============================================================
-- 4. handle_answer_count
-- Maintains the denormalized answer_count on questions.
-- Also awards rep points for posting an answer.
-- ============================================================
create or replace function public.handle_answer_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.questions
    set answer_count = answer_count + 1
    where id = new.question_id;

    update public.profiles
    set reputation_points = reputation_points + 15
    where id = new.author_id;

  elsif TG_OP = 'DELETE' then
    update public.questions
    set answer_count = greatest(0, answer_count - 1)
    where id = old.question_id;
  end if;

  return null;
end;
$$;

create trigger on_answer_insert_delete
  after insert or delete on public.answers
  for each row execute function public.handle_answer_count();

-- ============================================================
-- 5. handle_reputation_tier
-- Updates the tier column whenever reputation_points changes.
-- Runs BEFORE UPDATE so it can modify the same row.
-- ============================================================
create or replace function public.handle_reputation_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.tier := case
    when new.reputation_points >= 2000 then 'Gold'
    when new.reputation_points >= 500  then 'Silver'
    else 'Bronze'
  end;
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_reputation_change
  before update of reputation_points on public.profiles
  for each row execute function public.handle_reputation_tier();

-- ============================================================
-- 6. handle_professor_rating_stats
-- Recomputes aggregate stats whenever a rating is inserted, updated, or deleted.
-- Uses UPSERT into professor_rating_stats.
-- GPA formula: weighted avg of 5 most predictive dimensions, mapped to [0, 4].
-- ============================================================
create or replace function public.handle_professor_rating_stats()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pid uuid;
  r     record;
begin
  v_pid := coalesce(new.professor_id, old.professor_id);

  select
    count(*)::int                                                                     as cnt,
    avg(exam_fairness)::numeric(3,2)                                                  as ef,
    avg(grade_transparency)::numeric(3,2)                                             as gt,
    avg(lecture_quality)::numeric(3,2)                                                as lq,
    avg(office_hours_value)::numeric(3,2)                                             as ohv,
    avg(curve_likelihood)::numeric(3,2)                                               as cl,
    avg(curve_magnitude)::numeric(3,2)                                                as cm,
    avg(workload_realism)::numeric(3,2)                                               as wr,
    ( count(*) filter (where would_retake = true) )::numeric
      / nullif( count(*) filter (where would_retake is not null), 0 ) * 100           as retake_pct
  into r
  from public.professor_ratings
  where professor_id = v_pid;

  insert into public.professor_rating_stats (
    professor_id,
    rating_count,
    avg_exam_fairness, avg_grade_transparency, avg_lecture_quality,
    avg_office_hours_value, avg_curve_likelihood, avg_curve_magnitude, avg_workload_realism,
    overall_avg,
    estimated_gpa_low,
    estimated_gpa_high,
    would_retake_pct,
    updated_at
  ) values (
    v_pid,
    coalesce(r.cnt, 0),
    coalesce(r.ef,  0), coalesce(r.gt,  0), coalesce(r.lq,  0),
    coalesce(r.ohv, 0), coalesce(r.cl,  0), coalesce(r.cm,  0), coalesce(r.wr,  0),
    round((
      coalesce(r.ef, 0) + coalesce(r.gt, 0) + coalesce(r.lq, 0) +
      coalesce(r.ohv, 0) + coalesce(r.cl, 0) + coalesce(r.cm, 0) + coalesce(r.wr, 0)
    ) / 7.0, 2),
    -- GPA low: weighted formula from plan spec
    greatest(0.0, least(4.0, round(
      coalesce(r.cl, 0) * 0.30 +
      coalesce(r.cm, 0) * 0.25 +
      coalesce(r.ef, 0) * 0.25 +
      coalesce(r.gt, 0) * 0.10 +
      coalesce(r.wr, 0) * 0.10 - 1.0,
    2))),
    greatest(0.0, least(4.0, round(
      coalesce(r.cl, 0) * 0.30 +
      coalesce(r.cm, 0) * 0.25 +
      coalesce(r.ef, 0) * 0.25 +
      coalesce(r.gt, 0) * 0.10 +
      coalesce(r.wr, 0) * 0.10 - 1.0 + 0.4,
    2))),
    coalesce(r.retake_pct, 0),
    now()
  )
  on conflict (professor_id) do update set
    rating_count           = excluded.rating_count,
    avg_exam_fairness      = excluded.avg_exam_fairness,
    avg_grade_transparency = excluded.avg_grade_transparency,
    avg_lecture_quality    = excluded.avg_lecture_quality,
    avg_office_hours_value = excluded.avg_office_hours_value,
    avg_curve_likelihood   = excluded.avg_curve_likelihood,
    avg_curve_magnitude    = excluded.avg_curve_magnitude,
    avg_workload_realism   = excluded.avg_workload_realism,
    overall_avg            = excluded.overall_avg,
    estimated_gpa_low      = excluded.estimated_gpa_low,
    estimated_gpa_high     = excluded.estimated_gpa_high,
    would_retake_pct       = excluded.would_retake_pct,
    updated_at             = now();

  return coalesce(new, old);
end;
$$;

create trigger on_professor_rating_change
  after insert or update or delete on public.professor_ratings
  for each row execute function public.handle_professor_rating_stats();
-- ============================================================
-- Campus RPCs Migration 0004
-- Run AFTER 0003_triggers.sql
-- ============================================================

-- ============================================================
-- claim_session_request(p_request_id uuid)
-- Race-condition safe via FOR UPDATE SKIP LOCKED.
-- Verifies the calling user is a verified tutor for the
-- offering's course, atomically flips the request to 'matched',
-- creates a sessions row, adds the student as a participant,
-- and creates a notification.
-- Returns the new session id on success, null if already taken.
-- ============================================================
create or replace function public.claim_session_request(p_request_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_request  public.session_requests%rowtype;
  v_course_id uuid;
  v_session_id uuid;
begin
  -- Lock this specific request row; skip if another transaction holds it.
  select sr.*
  into v_request
  from public.session_requests sr
  where sr.id = p_request_id
    and sr.status = 'open'
  for update skip locked;

  -- If lock failed (already taken or not open) return null.
  if v_request.id is null then
    return null;
  end if;

  -- Verify the caller is a tutor for the offering's course.
  select co.course_id
  into v_course_id
  from public.course_offerings co
  where co.id = v_request.offering_id;

  if not exists (
    select 1 from public.verified_tutors
    where user_id = auth.uid()
      and course_id = v_course_id
  ) then
    raise exception 'not_verified_for_course';
  end if;

  -- Prevent tutors from claiming their own request.
  if v_request.student_id = auth.uid() then
    raise exception 'cannot_claim_own_request';
  end if;

  -- Mark request as matched.
  update public.session_requests
  set status = 'matched'
  where id = p_request_id;

  -- Create the session.
  insert into public.sessions (
    request_id,
    tutor_id,
    offering_id,
    format,
    max_students,
    scheduled_at,
    duration_minutes,
    price_per_student_display
  ) values (
    p_request_id,
    auth.uid(),
    v_request.offering_id,
    v_request.format,
    v_request.max_students,
    coalesce(v_request.proposed_at, now() + interval '1 hour'),
    v_request.duration_minutes,
    v_request.price_display
  )
  returning id into v_session_id;

  -- Add the requesting student as a participant.
  insert into public.session_participants (session_id, student_id, payment_status)
  values (v_session_id, v_request.student_id, 'simulated');

  -- Record a simulated payment transaction.
  insert into public.payment_transactions (
    user_id,
    transaction_type,
    amount,
    status,
    reference_type,
    reference_id
  ) values (
    v_request.student_id,
    'purchase',
    v_request.price_display,
    'simulated',
    'session',
    v_session_id
  );

  -- Notify the student.
  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    v_request.student_id,
    'session_claimed',
    'A tutor accepted your session request!',
    'Your session has been confirmed. Check the session page for the meeting link.',
    '/sessions/' || v_session_id
  );

  return v_session_id;
end;
$$;

-- Grant execute to authenticated users (RLS on called tables still applies
-- where this function does not bypass it; the SECURITY DEFINER runs as owner).
revoke all on function public.claim_session_request(uuid) from public;
grant execute on function public.claim_session_request(uuid) to authenticated;


-- ============================================================
-- get_material_download_url(p_material_id uuid)
-- Checks whether the calling user is allowed to download a material:
--   - material is free (is_free = true), OR
--   - the user has a purchase row
-- Returns the file_path so the Server Action can generate a
-- signed URL server-side using the service role key.
-- Raises an exception if the user does not have access.
-- ============================================================
create or replace function public.get_material_download_url(p_material_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_material public.materials%rowtype;
begin
  select * into v_material
  from public.materials
  where id = p_material_id
    and is_published = true
    and school_id = public.my_school_id();

  if v_material.id is null then
    raise exception 'material_not_found';
  end if;

  -- Free materials: anyone from the same school can download.
  if v_material.is_free then
    -- Increment download count.
    update public.materials
    set download_count = download_count + 1
    where id = p_material_id;

    return v_material.file_path;
  end if;

  -- Uploader can always download their own material.
  if v_material.uploader_id = auth.uid() then
    return v_material.file_path;
  end if;

  -- Everyone else must have a purchase row.
  if not exists (
    select 1 from public.material_purchases
    where material_id = p_material_id
      and buyer_id = auth.uid()
  ) then
    raise exception 'purchase_required';
  end if;

  update public.materials
  set download_count = download_count + 1
  where id = p_material_id;

  return v_material.file_path;
end;
$$;

revoke all on function public.get_material_download_url(uuid) from public;
grant execute on function public.get_material_download_url(uuid) to authenticated;
-- ============================================================
-- Campus Indexes Migration 0005
-- Run AFTER 0004_functions.sql
-- ============================================================

-- Feed: questions ordered by recency per offering, answers ranked by likes
create index if not exists idx_questions_offering_created
  on public.questions (offering_id, created_at desc);

create index if not exists idx_questions_school_created
  on public.questions (school_id, created_at desc);

create index if not exists idx_answers_question_likes
  on public.answers (question_id, like_count desc);

create index if not exists idx_answer_likes_answer
  on public.answer_likes (answer_id);

-- Sessions: open requests by offering for tutor dashboard
create index if not exists idx_session_requests_status_offering
  on public.session_requests (status, offering_id);

create index if not exists idx_session_requests_school_status
  on public.session_requests (school_id, status);

create index if not exists idx_sessions_tutor
  on public.sessions (tutor_id, scheduled_at desc);

-- Materials: browse by offering/type/school
create index if not exists idx_materials_offering_type
  on public.materials (offering_id, material_type);

create index if not exists idx_materials_school_type
  on public.materials (school_id, material_type);

create index if not exists idx_material_purchases_buyer
  on public.material_purchases (buyer_id);

-- Prof Pulse: ratings lookup by professor
create index if not exists idx_professor_ratings_professor
  on public.professor_ratings (professor_id);

-- Notifications: per-user unread, most recent first
create index if not exists idx_notifications_user_read_created
  on public.notifications (user_id, is_read, created_at desc);

-- Enrollments: fast lookup per user (used in many RLS policies)
create index if not exists idx_enrollments_user
  on public.enrollments (user_id);

-- Verified tutors: user lookup (used in RLS + claim RPC)
create index if not exists idx_verified_tutors_user
  on public.verified_tutors (user_id);

-- Study groups: member lookup (used in RLS policies)
create index if not exists idx_study_group_members_group_user
  on public.study_group_members (group_id, user_id);
