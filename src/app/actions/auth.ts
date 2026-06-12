'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const EDU_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.edu$/

export async function signInWithMagicLink(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()

  if (!EDU_REGEX.test(email)) {
    return { error: 'Please use your .edu email address.' }
  }

  const domain = email.split('@')[1]
  const supabase = await createClient()

  // If ALLOWED_EDU_DOMAINS is set, use it as the domain whitelist.
  // Otherwise fall back to checking the schools table (production default).
  const allowedEnv = process.env.ALLOWED_EDU_DOMAINS
  if (allowedEnv) {
    const allowed = allowedEnv
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
    if (!allowed.includes(domain)) {
      return { error: 'Your school is not registered yet. Check back soon.' }
    }
  } else {
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('domain', domain)
      .single()

    if (!school) {
      return { error: 'Your school is not registered yet. Check back soon.' }
    }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/login/verify')
}

// Dev-only: sign in directly as a seeded user without email.
//
// Why this approach instead of redirecting to the action_link URL:
// admin.generateLink produces an implicit-flow link. Supabase verifies it and
// redirects to the callback with tokens in the hash fragment (#access_token=...).
// Hash fragments are never sent to the server, so the route handler sees no
// code param and falls back to auth_callback_failed.
//
// Instead: generate the link, extract the hashed_token, and call verifyOtp
// directly on the SSR client. The SSR client sets session cookies in-process,
// then we redirect internally -- no browser round-trip to Supabase needed.
export async function devLogin(formData: FormData) {
  if (process.env.NODE_ENV !== 'development') {
    return { error: 'Dev login is not available in production.' }
  }

  const email = (formData.get('email') as string).trim().toLowerCase()
  if (!email) return { error: 'Email is required.' }

  const admin = createAdminClient()

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError) {
    console.error('[devLogin] generateLink error:', linkError)
    return { error: linkError.message }
  }

  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  if (verifyError) {
    console.error('[devLogin] verifyOtp error:', verifyError)
    return { error: verifyError.message }
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.error('[devLogin] verifyOtp succeeded but getUser returned null')
    return { error: 'Session could not be established.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete, school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) {
    redirect('/onboarding/school')
  }

  if (!profile?.onboarding_complete) {
    redirect('/onboarding/courses')
  }

  redirect('/feed')
}

export async function completeOnboardingSchool(formData: FormData): Promise<void> {
  const schoolId = formData.get('school_id') as string
  if (!schoolId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({ school_id: schoolId })
    .eq('id', user.id)

  redirect('/onboarding/courses')
}

export async function completeOnboardingCourses(offeringIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (offeringIds.length > 0) {
    const rows = offeringIds.map((oid) => ({
      user_id: user.id,
      offering_id: oid,
    }))

    const { error } = await supabase
      .from('enrollments')
      .upsert(rows, { onConflict: 'user_id,offering_id' })

    if (error) return { error: error.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  redirect('/feed')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Public demo login: signs in as the pre-seeded UCLA tutor demo account.
// Intentionally not gated behind NODE_ENV -- this is meant to be publicly
// accessible on the deployed site so visitors can explore without signing up.
export async function demoLogin() {
  const DEMO_EMAIL = 'tutor001@ucla.edu'

  const admin = createAdminClient()

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEMO_EMAIL,
  })

  if (linkError) {
    console.error('[demoLogin] generateLink error:', linkError)
    return { error: linkError.message }
  }

  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  if (verifyError) {
    console.error('[demoLogin] verifyOtp error:', verifyError)
    return { error: verifyError.message }
  }

  redirect('/feed')
}
