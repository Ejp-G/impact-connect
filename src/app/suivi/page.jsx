import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import SuiviClient from './SuiviClient'

export default async function SuiviPage({ searchParams }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const myId = session.user.id
  const secondaryRoles = profile?.secondary_roles || []
  const primaryRole = profile?.role

  const canViewTeam = ['admin', 'superviseur', 'responsable_suivi', 'equipe_suivi', 'integrateur', 'equipe_accueil'].includes(primaryRole)
    || secondaryRoles.some(r => ['responsable_suivi', 'equipe_suivi', 'integrateur', 'equipe_accueil'].includes(r))
  const canViewIndividuals = ['admin', 'superviseur', 'responsable_suivi'].includes(primaryRole)
    || secondaryRoles.includes('responsable_suivi')

  const canViewParcours = primaryRole === 'admin' || primaryRole === 'responsable_suivi'
    || secondaryRoles.includes('responsable_suivi')

  let viewAs = canViewTeam ? (searchParams?.viewAs || 'me') : 'me'
  if (viewAs !== 'me' && viewAs !== 'all' && !canViewIndividuals) viewAs = 'me'
  const viewingAll = viewAs === 'all'
  const targetId = viewAs === 'me' || !canViewTeam ? myId : viewAs

  const canViewNeedsBoard = ['superviseur', 'responsable_suivi', 'equipe_suivi'].includes(profile?.role)
    || secondaryRoles.includes('equipe_suivi')

  const { data: teamMembers } = canViewIndividuals
    ? await supabase.from('profiles')
        .select('id,name,role,secondary_roles')
        .eq('active', true)
        .order('name')
    : { data: [] }
  const suiviTeam = (teamMembers || []).filter(p =>
    ['equipe_suivi', 'responsable_suivi'].includes(p.role) || (p.secondary_roles || []).includes('equipe_suivi')
  )

  let targetContactIds = []
  if (!viewingAll) {
    const { data: integratorLinks } = await supabase
      .from('contact_integrators')
      .select('contact_id')
      .eq('integrator_id', targetId)
    targetContactIds = (integratorLinks || []).map(l => l.contact_id)
  }

  // CORRIGÉ : .eq('hors_territoire', false) ajouté — sans ce filtre, un
  // contact hors territoire restait visible dans "Suivi des nouveaux"
  // (liste complète) avec un badge de statut pouvant afficher "🔴 À
  // contacter", même s'il était déjà exclu de "Ma journée" et du
  // dashboard. Il reste bien sûr consultable via sa fiche/Visiteurs.
  let contactsQuery = supabase.from('contacts')
    .select(`
      id, first_name, last_name, sex, phone, whatsapp, email, commune, first_visit_date, created_at, stage,
      alert_level, integration_score, salvation_call, status, integrator_contacted,
      welcomed_by_name, hors_territoire,
      fi:familles_impact(name),
      integrators:contact_integrators(position, integrator:profiles(id,name))
    `)
    .eq('status', 'active')
    .eq('hors_territoire', false)
    .order('first_visit_date', { ascending: false })
  if (!viewingAll) {
    const idsClause = targetContactIds.length
      ? targetContactIds.join(',')
      : '00000000-0000-0000-0000-000000000000'
    contactsQuery = contactsQuery.or(`assigned_to.eq.${targetId},id.in.(${idsClause})`)
  }
  const { data: contacts } = await contactsQuery

  const contactIds = (contacts || []).map(c => c.id)

  const { data: reports } = contactIds.length
    ? await supabase.from('integrator_reports')
        .select('contact_id,contacted_at,method,result,notes,next_action,next_contact_date')
        .in('contact_id', contactIds)
        .order('contacted_at', { ascending: false })
    : { data: [] }

  const { data: needs } = contactIds.length
    ? await supabase.from('contact_needs')
        .select('id,contact_id,category,status,detected_at')
        .in('contact_id', contactIds)
    : { data: [] }

  const { data: allNeeds } = canViewNeedsBoard
    ? await supabase.from('contact_needs').select('id,contact_id,category,status,detected_at')
    : { data: [] }

  // CORRIGÉ : hors_territoire ajouté au select du contact lié, puis
  // filtré après récupération — Supabase ne permet pas de filtrer
  // directement sur une colonne d'une table jointe dans .eq(). Sans ce
  // filtre, une tâche générée par un cron (relance_nouvelles,
  // fiche_incomplete) pour un contact désormais hors territoire restait
  // visible dans l'onglet "Tâches" de ses intégrateurs.
  let tasksQuery = supabase.from('tasks')
    .select('*, contact:contacts(id,first_name,last_name,phone,sex,commune,hors_territoire), assignee:profiles!tasks_assigned_to_fkey(id,name)')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
  if (!viewingAll) {
    const idsClause = targetContactIds.length
      ? targetContactIds.join(',')
      : '00000000-0000-0000-0000-000000000000'
    tasksQuery = tasksQuery.or(`assigned_to.eq.${targetId},contact_id.in.(${idsClause})`)
  }
  const { data: tasksRaw } = await tasksQuery
  const tasks = (tasksRaw || []).filter(t => !t.contact?.hors_territoire)

  const { data: profiles } = await supabase.from('profiles').select('id,name').eq('active', true).order('name')
  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status', 'active').order('name')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active', true).order('name')

  const { data: parcoursList } = canViewParcours
    ? await supabase.from('parcours_integration')
        .select('id, token, status, current_step, form_data, contact_id, started_at, last_activity_at, finalized_at, to_relaunch')
        .is('contact_id', null)
        .order('last_activity_at', { ascending: false })
    : { data: [] }

  return (
    <AppLayout profile={profile} pageId="suivi" title="Suivi & Tâches">
      <SuiviClient
        contacts={contacts || []}
        reports={reports || []}
        needs={needs || []}
        allNeeds={allNeeds || []}
        canViewNeedsBoard={canViewNeedsBoard}
        tasks={tasks || []}
        profiles={profiles || []}
        profile={profile}
        canViewTeam={canViewTeam}
        canViewIndividuals={canViewIndividuals}
        suiviTeam={suiviTeam}
        viewAs={canViewTeam ? viewAs : 'me'}
        fis={fis || []}
        communes={communes || []}
        canViewParcours={canViewParcours}
        parcoursList={parcoursList || []}
      />
    </AppLayout>
  )
}
