import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  // Statistiques agrégées
  const [{ count: totalContacts }, { count: newThisMonth }, { count: salvations },
         { count: pendingTasks }, { count: alertsRed }, { data: fiData }] = await Promise.all([
    supabase.from('contacts').select('*', { count:'exact', head:true }).eq('status','active'),
    supabase.from('contacts').select('*', { count:'exact', head:true })
      .eq('status','active').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('contacts').select('*', { count:'exact', head:true }).eq('salvation_call', true)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('tasks').select('*', { count:'exact', head:true }).eq('status','pending'),
    supabase.from('contacts').select('*', { count:'exact', head:true }).eq('alert_level','red').eq('status','active'),
    supabase.from('familles_impact').select('id,name,capacity').eq('status','active'),
  ])

  // Contacts par stage
  const { data: stageData } = await supabase.from('contacts')
    .select('stage').eq('status','active')
  const stageCounts = {}
  stageData?.forEach(c => { stageCounts[c.stage] = (stageCounts[c.stage]||0) + 1 })

  // Membres par FI
  const { data: fiMembers } = await supabase.from('contacts')
    .select('fi_id').eq('status','active').not('fi_id','is',null)
  const fiMemberCounts = {}
  fiMembers?.forEach(c => { fiMemberCounts[c.fi_id] = (fiMemberCounts[c.fi_id]||0) + 1 })

  const stats = { totalContacts, newThisMonth, salvations, pendingTasks, alertsRed, stageCounts, fiData, fiMemberCounts }

  return (
    <AppLayout profile={profile} pageId="dashboard" title="Tableau de bord">
      <DashboardClient stats={stats} profile={profile} />
    </AppLayout>
  )
}
