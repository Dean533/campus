import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'
import { TopNav } from '@/components/TopNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, tier, reputation_points, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_complete) {
    redirect('/onboarding/school')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <TopNav
        displayName={profile?.display_name ?? user.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
        tier={profile?.tier ?? 'Bronze'}
        reputationPoints={profile?.reputation_points ?? 0}
        signOutAction={signOut}
      />
      <main>
        {children}
      </main>
    </div>
  )
}
