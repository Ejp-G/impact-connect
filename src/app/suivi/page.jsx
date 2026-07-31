import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import SuiviClient from './SuiviClient'

export default async function SuiviPage({ searchParams }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  // Les statistiques globales (Dashboard, Pipeline, Rapports) restent
  // partagees par toute l'equipe. Cette page de travail quotidien
  // (Suivi & Taches) reste PERSONNELLE par defaut, y compris pour un
  // administrateur. Seuls admin/responsable_suivi peuvent choisir de
  // regarder le portefeuille d'un autre membre ou de toute l'equipe,
  // via ?viewAs=<userId|all> — jamais un membre normal (protection
  // cote serveur, pas seulement cote UI, meme si le parametre d'URL
  // est manipule directement).
  const myId = session.user.id
  const canViewTeam = ['admin', 'responsable_suivi', 'superviseur'].includes(profile?.role)
    || (profile?.secondary_roles || []).includes('responsable_suivi')
  const viewAs = canViewTeam ? (searchParams?.viewAs || 'me') : 'me'
  const viewingAll = viewAs === 'all'
  const targetId = viewAs === 'me' || !canViewTeam ? myId : viewAs

  const { data: teamMembers } = canViewTeam
    ? await supabase.from('profiles')
        .select('id,name,role,secondary_roles')
        .eq('active', true)
        .order('name')
    : { data: [] }
  const suiviTeam = (teamMembers || []).filter(p =>
    ['equipe_suivi', 'responsable_suivi'].includes(p.role) || (p.secondary_roles || []).includes('equipe_suivi')
  )

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
  if (!viewingAll) contactsQuery = contactsQuery.eq('assigned_to', targetId)
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

  let tasksQuery = supabase.from('tasks')
    .select('*, contact:contacts(id,first_name,last_name,sex,commune), assignee:profiles!tasks_assigned_to_fkey(id,name)')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
  if (!viewingAll) tasksQuery = tasksQuery.eq('assigned_to', targetId)
  const { data: tasks } = await tasksQuery

  const { data: profiles } = await supabase.from('profiles').select('id,name').eq('active', true).order('name')
  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status', 'active').order('name')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active', true).order('name')

  return (
    <AppLayout profile={profile} pageId="suivi" title="Suivi & Tâches">
      <SuiviClient
        contacts={contacts || []}
        reports={reports || []}
        needs={needs || []}
        tasks={tasks || []}
        profiles={profiles || []}
        profile={profile}
        canViewTeam={canViewTeam}
        suiviTeam={suiviTeam}
        viewAs={canViewTeam ? viewAs : 'me'}
        fis={fis || []}
        communes={communes || []}
      />
    </AppLayout>
  )
}
