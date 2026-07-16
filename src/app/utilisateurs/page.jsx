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
  const { data: users, error } = await adminClient.from('profiles').select('*,fi:familles_impact(id,name)').order('name')
  const { data: fis } = await adminClient.from('familles_impact').select('id,name').order('name')

  console.log('USERS:', JSON.stringify(users))
  console.log('ERROR:', JSON.stringify(error))

  return (
    <AppLayout profile={profile} pageId="utilisateurs" title="Gestion des utilisateurs">
      <div style={{padding:20,background:'#fff',margin:20,borderRadius:8}}>
        <p><strong>Nombre users:</strong> {users?.length || 0}</p>
        <p><strong>Erreur:</strong> {error?.message || 'aucune'}</p>
        <pre>{JSON.stringify(users, null, 2)}</pre>
      </div>
      <UtilisateursClient users={users || []} fis={fis || []} />
    </AppLayout>
  )
}
