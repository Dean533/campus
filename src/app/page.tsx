import { createClient } from '@/lib/supabase/server'
import { WebGLHero } from '@/components/ui/WebGLHero'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let displayName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    displayName = profile?.display_name ?? user.email ?? null
  }

  return <WebGLHero isLoggedIn={!!user} displayName={displayName} />
}
