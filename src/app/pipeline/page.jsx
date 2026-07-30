import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PipelineClient from './PipelineClient'

const FUNNEL_STAGES = ['visiteur', 'contacte', 'invite_fi', 'fi1', 'fi2', 'integre', 'parcours']

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const { data: contacts } = await supabase.from('contacts')
    .select(`
      id,first_name,last_name,sex,commune,quartier,phone,stage,integration_score,alert_level,
      first_visit_date,last_contact_at,baptism_date,created_at,stage_updated_at,
      fi:familles_impact(id,name,pilot:profiles!familles_impact_pilot_id_fkey(name)),
      agent:profiles!contacts_assigned_to_fkey(name)
    `)
    .eq('status', 'active').order('integration_score', { ascending: false })
  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status', 'active')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active', true).order('name')

  // Derniere action connue par contact (journal d'audit), une seule
  // requete groupee.
  const contactIds = (contacts || []).map(c => c.id)
  const { data: auditRows } = contactIds.length
    ? await supabase.from('audit_log')
        .select('entity_id,action,created_at')
        .eq('entity_type', 'contact')
        .in('entity_id', contactIds)
        .order('created_at', { ascending: false })
    : { data: [] }
  const lastActionByContact = {}
  auditRows?.forEach(r => { if (!lastActionByContact[r.entity_id]) lastActionByContact[r.entity_id] = r })

  const enrichedContacts = (contacts || []).map(c => ({
    ...c,
    lastAction: lastActionByContact[c.id]?.action || null,
    lastActionDate: lastActionByContact[c.id]?.created_at || null,
  }))

  const now = new Date()
  const d30 = new Date(now - 30 * 86400000).toISOString()
  const d60 = new Date(now - 60 * 86400000).toISOString()
  const d30Date = d30.slice(0, 10)
  const d60Date = d60.slice(0, 10)

  // Evolution par etape : stage_updated_at existe deja en base et se
  // met a jour a chaque changement d'etape (route /api/contacts/[id]/stage).
  // Pour "Visiteur" specifiquement, on utilise first_visit_date plutot,
  // car les visiteurs jamais deplaces n'ont pas encore de stage_updated_at.
  const stageEvolution = {}
  FUNNEL_STAGES.forEach(stageId => {
    if (stageId === 'visiteur') {
      const last30 = (contacts || []).filter(c => c.first_visit_date >= d30Date).length
      const prev30 = (contacts || []).filter(c => c.first_visit_date >= d60Date && c.first_visit_date < d30Date).length
      stageEvolution[stageId] = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null
      return
    }
    const last30 = (contacts || []).filter(c => c.stage === stageId && c.stage_updated_at >= d30).length
    const prev30 = (contacts || []).filter(c => c.stage === stageId && c.stage_updated_at >= d60 && c.stage_updated_at < d30).length
    stageEvolution[stageId] = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null
  })

  return (
    <AppLayout profile={profile} pageId="pipeline" title="Pipeline d'Intégration">
      <PipelineClient
        contacts={enrichedContacts}
        fis={fis || []}
        communes={communes || []}
        stageEvolution={stageEvolution}
      />
    </AppLayout>
  )
}
