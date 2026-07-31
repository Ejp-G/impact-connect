import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import SuiviClient from './SuiviClient'

export default async function SuiviPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  // Les statistiques globales (Dashboard, Pipeline, Rapports) restent
  // partagees par toute l'equipe. En revanche, cette page de travail
  // quotidien (Suivi & Taches) est desormais strictement PERSONNELLE,
  // y compris pour un administrateur : chacun ne voit que les visiteurs
  // et taches dont il est le responsable reel, pour que sa liste
  // diminue au fur et a mesure qu'il assigne des integrateurs plutot
  // que de rester englue avec tout ce qu'il a cree ou importe.
  // Evolution prevue plus tard : un selecteur admin "Mes taches /
  // Taches de {membre} / Toutes les taches" pourra remplacer ce filtre
  // fixe sans toucher au reste de la page — il suffira de faire varier
  // la valeur passee a .eq('assigned_to', ...) ci-dessous.
  const myId = session.user.id

  const { data: contacts } = await supabase.from('contacts')
    .select(`
      id, first_name, last_name, sex, phone, commune, first_visit_date, created_at, stage,
      alert_level, integration_score, salvation_call, status, integrator_contacted,
      welcomed_by_name,
      fi:familles_impact(name),
      integrators:contact_integrators(position, integrator:profiles(id,name))
    `)
    .eq('status', 'active')
    .eq('assigned_to', myId)
    .order('first_visit_date', { ascending: false })

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

  const { data: tasks } = await supabase.from('tasks')
    .select('*, contact:contacts(id,first_name,last_name,sex,commune), assignee:profiles!tasks_assigned_to_fkey(id,name)')
    .eq('status', 'pending')
    .eq('assigned_to', myId)
    .order('due_date', { ascending: true })

  const { data: profiles } = await supabase.from('profiles').select('id,name').eq('active', true).order('name')

  return (
    <AppLayout profile={profile} pageId="suivi" title="Suivi & Tâches">
      <SuiviClient
        contacts={contacts || []}
        reports={reports || []}
        needs={needs || []}
        tasks={tasks || []}
        profiles={profiles || []}
        profile={profile}
      />
    </AppLayout>
  )
}
