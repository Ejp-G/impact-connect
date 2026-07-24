import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import SuiviClient from './SuiviClient'

export default async function SuiviPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const isAdmin = ['admin', 'responsable_suivi', 'responsable_integration'].includes(profile?.role)
  let q = supabase.from('tasks').select('*,contact:contacts(id,first_name,last_name,sex,commune),assignee:profiles!tasks_assigned_to_fkey(id,name)')
    .eq('status', 'pending').order('due_date', { ascending: true })
  if (!isAdmin) q = q.eq('assigned_to', session.user.id)
  const { data: tasks } = await q
  const { data: profiles } = await supabase.from('profiles').select('id,name').order('name')
  return (
    <AppLayout profile={profile} pageId="suivi" title="Suivi & Tâches">
      <SuiviClient tasks={tasks || []} profile={profile} profiles={profiles || []} />
    </AppLayout>
  )
}
