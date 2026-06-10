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
