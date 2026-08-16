import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import DashboardClient from './DashboardClient'
import { isTaskTrulyOverdue, getContactCategory, getContactStatus } from '@/lib/suivi-priority'
export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  // Toutes les dates de reference ci-dessous utilisent desormais
  // first_visit_date (la vraie date de premiere visite) plutot que
  // created_at (date d'enregistrement en base, qui peut etre tres
  // differente en cas d'import tardif de vieilles fiches).
  const today = new Date().toISOString().slice(0, 10)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  // Statistiques agrégées
  // CORRIGÉ : alertsRed ne vient plus d'un COUNT sur contacts.alert_level
  // (champ figé, recalculé une fois par nuit par le cron
  // update_alerts_and_scores, qui ignore l'ancienneté du contact — voir
  // ci-dessous, calcul recalculé "à la volée" à la place).
  const [{ count: totalContacts }, { count: newThisMonth }, { count: salvations },
         { count: pendingTasks }, { data: fiData }] = await Promise.all([
    supabase.from('contacts').select('*', { count:'exact', head:true }).eq('status','active'),
    supabase.from('contacts').select('*', { count:'exact', head:true })
      .eq('status','active').gte('first_visit_date', startOfMonth),
    supabase.from('contacts').select('*', { count:'exact', head:true }).eq('salvation_call', true)
      .gte('first_visit_date', startOfMonth),
    supabase.from('tasks').select('*', { count:'exact', head:true }).eq('status','pending').eq('assigned_to', session.user.id),
    // Toutes les FIJ sauf celles definitivement fermees : une FIJ "en
    // developpement" ou "en pause" reste une FIJ existante et doit
    // compter dans le total (seul 'fermee' est exclu).
    supabase.from('familles_impact').select('id,name,capacity,status,day,time').neq('status','fermee'),
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

  // ---------- Alertes urgentes (recalcul à la volée, remplace alert_level) ----------
  // "Urgent" = contact récent (catégorie prioritaire ou normal, donc
  // arrivé ce mois-ci ou le précédent — voir getContactCategory) ET
  // dont le statut réel (getContactStatus, basé sur integrator_contacted
  // + next_contact_date) est "à contacter". Un contact de plus de deux
  // mois n'est plus jamais compté ici, même si son alert_level historique
  // était "red" : il relève de "à relancer", pas d'urgence.
  const { data: alertContacts } = await supabase.from('contacts')
    .select('id,first_visit_date,created_at,stage,integrator_contacted')
    .eq('status', 'active')
  const alertContactIds = (alertContacts || []).map(c => c.id)
  const { data: alertReports } = alertContactIds.length
    ? await supabase.from('integrator_reports')
        .select('contact_id,contacted_at,next_contact_date')
        .in('contact_id', alertContactIds)
        .order('contacted_at', { ascending: false })
    : { data: [] }
  const lastReportByContact = {}
  ;(alertReports || []).forEach(r => {
    if (!lastReportByContact[r.contact_id]) lastReportByContact[r.contact_id] = r
  })
  const nowRef = new Date()
  const alertsRed = (alertContacts || []).filter(c => {
    const category = getContactCategory(c, nowRef)
    if (category !== 'prioritaire' && category !== 'normal') return false
    const status = getContactStatus(c, lastReportByContact[c.id], nowRef)
    return status.key === 'a_contacter'
  }).length

  const stats = { totalContacts, newThisMonth, salvations, pendingTasks, alertsRed, stageCounts, fiData, fiMemberCounts, fiPausedCount }

  // Croissance annuelle (mois par mois, annee civile en cours), basee
  // sur first_visit_date. On ne filtre PAS par status='active' ici :
  // contrairement au reste du dashboard, ce graphique retrace
  // l'historique reel, y compris les contacts depuis archives, pour
  // que les mois passes ne se deforment pas au fil du temps quand un
  // visiteur ancien est archive.
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const yearEnd   = new Date(new Date().getFullYear() + 1, 0, 1).toISOString().slice(0, 10)
  const [{ data: visitorRows }, { data: integrationRows }, { data: cultesRows }] = await Promise.all([
    supabase.from('contacts').select('first_visit_date')
      .gte('first_visit_date', yearStart).lt('first_visit_date', yearEnd),
    supabase.from('contacts').select('integrated_at')
      .not('integrated_at', 'is', null)
      .gte('integrated_at', yearStart).lt('integrated_at', yearEnd),
    supabase.from('cultes').select('date,nouveaux_comptes')
      .gte('date', yearStart).lt('date', yearEnd),
  ])
  const monthlyVisitors = Array(12).fill(0)
  visitorRows?.forEach(r => {
    if (!r.first_visit_date) return
    const m = new Date(r.first_visit_date).getMonth()
    monthlyVisitors[m] += 1
  })
  const monthlyIntegrations = Array(12).fill(0)
  integrationRows?.forEach(r => {
    const m = new Date(r.integrated_at).getMonth()
    monthlyIntegrations[m] += 1
  })
  // Comptage manuel Accueil (nouveaux_comptes saisi par culte) : distinct
  // des visiteurs "formulaire rempli" ci-dessus, permet de reperer un
  // ecart (personnes reperees a l'accueil mais jamais inscrites).
  const monthlyAccueil = Array(12).fill(0)
  cultesRows?.forEach(r => {
    if (!r.nouveaux_comptes) return
    const m = new Date(r.date).getMonth()
    monthlyAccueil[m] += r.nouveaux_comptes
  })

  stats.monthlyVisitors = monthlyVisitors
  stats.monthlyIntegrations = monthlyIntegrations
  stats.monthlyAccueil = monthlyAccueil

  // ---------- Hero vivant : "aujourd'hui en un coup d'oeil" ----------
  const { count: newToday } = await supabase.from('contacts')
    .select('*', { count:'exact', head:true }).eq('status','active').eq('first_visit_date', today)

  const FRENCH_DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const todayName = FRENCH_DAYS[new Date().getDay()]
  const fiTonight = fiData?.find(f => f.day === todayName && f.status !== 'fermee') || null

  stats.newToday = newToday || 0
  stats.fiTonight = fiTonight

  // ---------- Taches en retard (banniere persistante) ----------
  // Personnelle pour un intégrateur normal ; visible sur TOUTE
  // l'équipe pour superviseur/responsable_suivi/admin (role de
  // garde-fou), y compris via le role secondaire responsable_suivi.
  //
  // "en retard" doit être réservé aux contacts récents (arrivés ce
  // mois-ci ou le précédent) — voir isTaskTrulyOverdue dans
  // lib/suivi-priority.js. Une vieille tâche liée à un contact de plus
  // de 2 mois n'est plus un "retard" mais une "relance" (stats.toRelaunchTasks),
  // pour ne pas donner le sentiment trompeur de dizaines de retards.
  // La limite passe de 20 à 300 : avec l'ancien tri "due_date ascending
  // + limit 20", les tâches les plus anciennes (souvent hors sujet)
  // remplissaient déjà toute la liste avant même le filtrage.
  const isSupervisorView = ['admin', 'responsable_suivi', 'superviseur'].includes(profile?.role)
    || (profile?.secondary_roles || []).includes('responsable_suivi')
  let overdueQuery = supabase.from('tasks')
    .select('id,title,type,due_date,contact:contacts(id,first_name,last_name,first_visit_date,created_at,stage),assignee:profiles!tasks_assigned_to_fkey(name)')
    .eq('status', 'pending')
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(300)
  if (!isSupervisorView) overdueQuery = overdueQuery.eq('assigned_to', session.user.id)
  const { data: overdueTasksRaw } = await overdueQuery

  const trulyOverdue = []
  const toRelaunch = []
  ;(overdueTasksRaw || []).forEach(t => {
    if (!t.contact) return
    if (isTaskTrulyOverdue(t, t.contact, nowRef)) trulyOverdue.push(t)
    else toRelaunch.push(t)
  })
  stats.overdueTasks = trulyOverdue
  stats.toRelaunchTasks = toRelaunch
  stats.overdueIsTeamWide = isSupervisorView

  // ---------- Mon espace de suivi ----------
  const [{ data: myTasksToday }, { count: myContactsCount }] = await Promise.all([
    supabase.from('tasks').select('id,title,type,due_date,contact:contacts(id,first_name,last_name)')
      .eq('status', 'pending').eq('assigned_to', session.user.id).eq('due_date', today),
    supabase.from('contacts').select('*', { count:'exact', head:true })
      .eq('status', 'active').eq('assigned_to', session.user.id),
  ])
  stats.myTasksToday = myTasksToday || []
  stats.myContactsCount = myContactsCount || 0

  // ---------- Verification du dernier culte (Module Accueil) ----------
  const { data: lastCulte } = await supabase.from('cultes')
    .select('*').order('date', { ascending: false }).limit(1).maybeSingle()
  if (lastCulte) {
    const { count: actualNouveaux } = await supabase.from('contacts')
      .select('*', { count:'exact', head:true }).eq('first_visit_date', lastCulte.date)
    const { count: actualSalut } = await supabase.from('contacts')
      .select('*', { count:'exact', head:true }).eq('first_visit_date', lastCulte.date).eq('salvation_call', true)
    stats.culteCheck = {
      date: lastCulte.date,
      presents: lastCulte.presents,
      nouveauxComptes: lastCulte.nouveaux_comptes,
      nouveauxReels: actualNouveaux || 0,
      salutComptes: lastCulte.appels_au_salut_comptes,
      salutReels: actualSalut || 0,
    }
  }

  // ---------- Activite recente : fusion de plusieurs sources ----------
  const [
    { data: recentContacts },
    { data: recentIntegrations },
    { data: recentReports },
    { data: recentNeeds },
  ] = await Promise.all([
    supabase.from('contacts').select('id,first_name,last_name,created_at')
      .eq('status','active').order('created_at',{ascending:false}).limit(5),
    supabase.from('contacts').select('id,first_name,last_name,integrated_at')
      .not('integrated_at','is',null).order('integrated_at',{ascending:false}).limit(5),
    supabase.from('integrator_reports').select('id,contacted_at,contact:contacts(first_name,last_name),integrator:profiles(name)')
      .order('contacted_at',{ascending:false}).limit(5),
    supabase.from('contact_needs').select('id,category,detected_at,contact:contacts(first_name,last_name)')
      .order('detected_at',{ascending:false}).limit(5),
  ])

  stats.activityFeed = [
    ...(recentContacts||[]).map(c => ({ type:'new_contact', date:c.created_at, name:`${c.first_name} ${c.last_name}`, detail:'Nouveau visiteur' })),
    ...(recentIntegrations||[]).map(c => ({ type:'integration', date:c.integrated_at, name:`${c.first_name} ${c.last_name}`, detail:"Intégré(e) en Famille d'Impact" })),
    ...(recentReports||[]).map(r => ({ type:'report', date:r.contacted_at, name:`${r.contact?.first_name||''} ${r.contact?.last_name||''}`.trim(), detail:`Contacté par ${r.integrator?.name||'—'}` })),
    ...(recentNeeds||[]).map(n => ({ type:'need', date:n.detected_at, name:`${n.contact?.first_name||''} ${n.contact?.last_name||''}`.trim(), detail:'Besoin détecté' })),
  ].filter(a => a.date).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,8)

  return (
    <AppLayout profile={profile} pageId="dashboard" title="Tableau de bord">
      <DashboardClient stats={stats} profile={profile} />
    </AppLayout>
  )
}
