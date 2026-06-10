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
