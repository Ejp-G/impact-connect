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
    // Toutes les FIJ sauf celles definitivement fermees : une FIJ "en
    // developpement" ou "en pause" reste une FIJ existante et doit
    // compter dans le total (seul 'fermee' est exclu).
    supabase.from('familles_impact').select('id,name,capacity,status').neq('status','fermee'),
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

  // Nombre de FIJ en pause, pour la mention discrete "X FIJ dont Y en
  // pause" affichee sur la carte Dashboard (les FIJ en pause comptent
  // dans le total mais meritent d'etre signalees separement).
  const fiPausedCount = fiData?.filter(f => f.status === 'en_pause').length || 0

  // Croissance annuelle (mois par mois, annee civile en cours). On ne
  // filtre PAS par status='active' ici : contrairement au reste du
  // dashboard, ce graphique retrace l'historique reel, y compris les
  // contacts depuis archives, pour que les mois passes ne se deforment
  // pas au fil du temps quand un visiteur ancien est archive.
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const yearEnd   = new Date(new Date().getFullYear() + 1, 0, 1).toISOString()
  const [{ data: visitorRows }, { data: integrationRows }] = await Promise.all([
    supabase.from('contacts').select('created_at')
      .gte('created_at', yearStart).lt('created_at', yearEnd),
    supabase.from('contacts').select('integrated_at')
      .not('integrated_at', 'is', null)
      .gte('integrated_at', yearStart).lt('integrated_at', yearEnd),
  ])
  const monthlyVisitors = Array(12).fill(0)
  visitorRows?.forEach(r => {
    const m = new Date(r.created_at).getMonth()
    monthlyVisitors[m] += 1
  })
  const monthlyIntegrations = Array(12).fill(0)
  integrationRows?.forEach(r => {
    const m = new Date(r.integrated_at).getMonth()
    monthlyIntegrations[m] += 1
  })

  const stats = { totalContacts, newThisMonth, salvations, pendingTasks, alertsRed, stageCounts, fiData, fiMemberCounts, fiPausedCount, monthlyVisitors, monthlyIntegrations }
  return (
    <AppLayout profile={profile} pageId="dashboard" title="Tableau de bord">
      <DashboardClient stats={stats} profile={profile} />
    </AppLayout>
  )
}
