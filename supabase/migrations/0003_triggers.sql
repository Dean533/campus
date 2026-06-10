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
