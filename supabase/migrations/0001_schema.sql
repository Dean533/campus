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
