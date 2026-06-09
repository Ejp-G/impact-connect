import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()

  const defaults = {
    admin:'/dashboard', responsable_integration:'/dashboard',
    equipe_integration:'/visiteurs', responsable_suivi:'/suivi',
    equipe_suivi:'/suivi', pilote_fi:'/fi',
    superviseur:'/dashboard', responsable_jeunesse:'/jeunesse',
  }
  redirect(defaults[profile?.role] || '/dashboard')
}
