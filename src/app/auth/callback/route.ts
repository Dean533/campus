import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('[auth/callback] incoming params:', Object.fromEntries(searchParams.entries()))

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[auth/callback] exchangeCodeForSession error:', exchangeError)
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error('[auth/callback] getUser error:', userError)
      } else if (!user) {
        console.error('[auth/callback] getUser returned no user after successful exchange')
      } else {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_complete, school_id')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('[auth/callback] profile fetch error:', profileError)
        }

        if (!profile || !profile.school_id) {
          return NextResponse.redirect(new URL('/onboarding/school', request.url))
        }

        if (!profile.onboarding_complete) {
          return NextResponse.redirect(new URL('/onboarding/courses', request.url))
        }

        return NextResponse.redirect(new URL(next, request.url))
      }
    }
  } else {
    console.error('[auth/callback] no code param in request -- URL was:', request.url)
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', request.url))
}
