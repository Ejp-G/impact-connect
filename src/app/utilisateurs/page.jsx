import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import UtilisateursClient from './UtilisateursClient'

export default async function UtilisateursPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: users } = await adminClient
    .from('profiles')
    .select('*')
    .order('name')
  const { data: fis } = await adminClient.from('familles_impact').select('id,name').order('name')

  return (
    <AppLayout profile={profile} pageId="utilisateurs" title="Gestion des utilisateurs">
      <UtilisateursClient users={users || []} fis={fis || []} />
    </AppLayout>
  )
}
