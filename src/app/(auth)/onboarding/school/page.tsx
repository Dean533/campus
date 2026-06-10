import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completeOnboardingSchool } from '@/app/actions/auth'

export default async function OnboardingSchoolPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (profile?.school_id) {
    redirect('/onboarding/courses')
  }

  const domain = user.email?.split('@')[1] ?? ''

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, domain')
    .order('name')

  const detectedSchool = schools?.find((s) => s.domain === domain)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 32,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
        Confirm your school
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
        {detectedSchool
          ? `We detected your school from your email address. Confirm below.`
          : `Select your school to continue.`}
      </p>

      <form action={completeOnboardingSchool}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {schools?.map((school) => (
            <label
              key={school.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                border: school.id === detectedSchool?.id
                  ? '2px solid #6366f1'
                  : '1px solid #e2e8f0',
                borderRadius: 8,
                cursor: 'pointer',
                background: school.id === detectedSchool?.id ? '#eef2ff' : '#fff',
              }}
            >
              <input
                type="radio"
                name="school_id"
                value={school.id}
                defaultChecked={school.id === detectedSchool?.id}
                required
                style={{ accentColor: '#6366f1' }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>
                  {school.name}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>@{school.domain}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          type="submit"
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            background: '#6366f1',
            color: '#fff',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </form>
    </div>
  )
}
