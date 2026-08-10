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

  // canViewTeam (large) : accorde le choix "Mes taches / Toute l'equipe" a
  // toute l'equipe operationnelle (suivi, integration, accueil), en plus
  // des roles de supervision qui l'avaient deja.
  // canViewIndividuals (restreint) : seul un role de supervision peut en
  // plus choisir un membre precis par son nom dans le menu — protection
  // cote serveur, pas seulement cote UI, meme si le parametre d'URL est
  // manipule directement.
  const canViewTeam = ['admin', 'superviseur', 'responsable_suivi', 'equipe_suivi', 'integrateur', 'equipe_accueil'].includes(primaryRole)
    || secondaryRoles.some(r => ['responsable_suivi', 'equipe_suivi', 'integrateur', 'equipe_accueil'].includes(r))
  const canViewIndividuals = ['admin', 'superviseur', 'responsable_suivi'].includes(primaryRole)
    || secondaryRoles.includes('responsable_suivi')

  // Onglet "Parcours en cours" : reserve au Responsable Suivi &
  // Intégration (et admin). RLS sur parcours_integration applique de
  // toute facon la meme restriction cote base — cette variable ne fait
  // que masquer l'onglet cote UI pour ne pas polluer les autres roles.
  const canViewParcours = primaryRole === 'admin' || primaryRole === 'responsable_suivi'
    || secondaryRoles.includes('responsable_suivi')

  let viewAs = canViewTeam ? (searchParams?.viewAs || 'me') : 'me'
  if (viewAs !== 'me' && viewAs !== 'all' && !canViewIndividuals) viewAs = 'me'
  const viewingAll = viewAs === 'all'
  const targetId = viewAs === 'me' || !canViewTeam ? myId : viewAs

  // Tableau intelligent des besoins : outil collaboratif, distinct de
  // la logique "mon portefeuille / portefeuille de X" ci-dessus.
  // Visible pour equipe_suivi (principal ou secondaire), superviseur,
  // responsable_suivi — jamais scope a un seul intégrateur, car le
  // suivi des besoins est un travail d'equipe.
  const canViewNeedsBoard = ['superviseur', 'responsable_suivi', 'equipe_suivi'].includes(profile?.role)
    || secondaryRoles.includes('equipe_suivi')

  // La liste nominative (menu "Tâches de X") reste volontairement
  // limitee a equipe_suivi/responsable_suivi, comme avant — accueil et
  // integrateur ne sont pas ajoutes a cette liste, meme s'ils peuvent
  // desormais basculer sur "Toute l'équipe".
  const { data: teamMembers } = canViewIndividuals
    ? await supabase.from('profiles')
        .select('id,name,role,secondary_roles')
        .eq('active', true)
        .order('name')
    : { data: [] }
  const suiviTeam = (teamMembers || []).filter(p =>
    ['equipe_suivi', 'responsable_suivi'].includes(p.role) || (p.secondary_roles || []).includes('equipe_suivi')
  )

  // Portefeuille reel de targetId : on ne peut PAS se fier uniquement
  // a contacts.assigned_to, qui ne reflete que l'integrateur position 1
  // (principal). Un binome en position 2 dans contact_integrators doit
  // aussi voir/recevoir ces visiteurs et taches — sinon des ames ne
  // sont jamais rappelees par le second integrateur qui ignore meme
  // qu'on lui a confie ce suivi.
  let targetContactIds = []
  if (!viewingAll) {
    const { data: integratorLinks } = await supabase
      .from('contact_integrators')
      .select('contact_id')
      .eq('integrator_id', targetId)
    targetContactIds = (integratorLinks || []).map(l => l.contact_id)
  }

  let contactsQuery = supabase.from('contacts')
    .select(`
      id, first_name, last_name, sex, phone, commune, first_visit_date, created_at, stage,
      alert_level, integration_score, salvation_call, status, integrator_contacted,
      welcomed_by_name,
      fi:familles_impact(name),
      integrators:contact_integrators(position, integrator:profiles(id,name))
    `)
    .eq('status', 'active')
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

  // Besoins non filtres, toute l'equipe — uniquement pour les roles
  // autorises a voir le tableau collaboratif. Independant du filtre
  // "Mes taches / Toute l'equipe" utilise pour le reste de la page.
  const { data: allNeeds } = canViewNeedsBoard
    ? await supabase.from('contact_needs').select('id,contact_id,category,status,detected_at')
    : { data: [] }

  // Meme logique pour les taches : un binome doit voir les taches liees
  // aux contacts dont il est integrateur, meme si assigned_to pointe
  // vers le principal.
  let tasksQuery = supabase.from('tasks')
    .select('*, contact:contacts(id,first_name,last_name,phone,sex,commune), assignee:profiles!tasks_assigned_to_fkey(id,name)')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
  if (!viewingAll) {
    const idsClause = targetContactIds.length
      ? targetContactIds.join(',')
      : '00000000-0000-0000-0000-000000000000'
    tasksQuery = tasksQuery.or(`assigned_to.eq.${targetId},contact_id.in.(${idsClause})`)
  }
  const { data: tasks } = await tasksQuery

  const { data: profiles } = await supabase.from('profiles').select('id,name').eq('active', true).order('name')
  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status', 'active').order('name')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active', true).order('name')

  // Parcours d'integration non lies a un contact deja affiche ailleurs :
  // la RLS de parcours_integration limite deja cette lecture a
  // admin/responsable_suivi cote base, canViewParcours ne fait que
  // masquer l'onglet pour les autres roles.
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
