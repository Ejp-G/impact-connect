import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// =========================================================
// RELANCES BIENVEILLANTES
// =========================================================
// Deux mecanismes independants, sans email — juste une tache douce qui
// apparait dans Suivi & Taches. S'arrete des qu'un contact atteint un
// stage avance (parcours, bapteme, service, leader_pot, leader) : au-dela,
// le suivi rapproche n'a plus lieu d'etre. Genere une tache par membre
// du binome assigne (contact_integrators), jamais de doublon tant qu'une
// tache du meme type est deja en attente pour ce contact + cet integrateur.
//
// hors_territoire=true exclu (STOP_STAGES) : un contact hors territoire
// ne doit plus jamais recevoir de nouvelle tâche automatique.
//
// contact_preference='none' exclu également : un contact marqué "à
// porter dans la prière / ne pas contacter" (via le bouton dédié dans
// NewcomerReportPanel.jsx ou la fiche visiteur) ne doit plus jamais
// recevoir de relance automatique — c'est justement le principe de ce
// statut, et ce champ était déjà lu ailleurs dans l'app sans être
// respecté ici jusqu'à ce correctif.
// =========================================================

const RELANCE_INTERVAL_DAYS = 15
const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

// Garde-fou n°1 : relance "prendre des nouvelles", tous les 15 jours,
// meme si la personne a deja ete contactee — c'est justement le principe
// (rester en lien, pas seulement traiter une premiere prise de contact).
async function checkRelancesNouvelles(supabase) {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, first_visit_date, created_at, assignment_date, integrators:contact_integrators(integrator_id)')
    .eq('status', 'active')
    .eq('hors_territoire', false)
    .neq('contact_preference', 'none')
    .not('stage', 'in', `(${STOP_STAGES.join(',')})`)

  if (!contacts?.length) return { checked: 'relances_nouvelles', created: 0 }

  const contactIds = contacts.map(c => c.id)

  // Dernier compte-rendu enregistre par contact (le plus recent en premier
  // grace au tri, donc on ne garde que la premiere occurrence rencontree).
  const { data: reports } = await supabase
    .from('integrator_reports')
    .select('contact_id, contacted_at')
    .in('contact_id', contactIds)
    .order('contacted_at', { ascending: false })
  const lastReportByContact = {}
  reports?.forEach(r => { if (!lastReportByContact[r.contact_id]) lastReportByContact[r.contact_id] = r.contacted_at })

  // Derniere relance déjà completee par contact, pour ne pas relancer
  // avant les 15 jours meme si aucun nouveau compte-rendu n'a ete saisi.
  const { data: lastDone } = await supabase
    .from('tasks')
    .select('contact_id, done_at')
    .eq('type', 'relance_nouvelles')
    .eq('status', 'done')
    .in('contact_id', contactIds)
    .order('done_at', { ascending: false })
  const lastDoneByContact = {}
  lastDone?.forEach(t => { if (!lastDoneByContact[t.contact_id]) lastDoneByContact[t.contact_id] = t.done_at })

  // Relances deja en attente, pour eviter tout doublon.
  const { data: pending } = await supabase
    .from('tasks')
    .select('contact_id, assigned_to')
    .eq('type', 'relance_nouvelles')
    .eq('status', 'pending')
    .in('contact_id', contactIds)
  const pendingSet = new Set((pending || []).map(t => `${t.contact_id}:${t.assigned_to}`))

  const rows = []
  const today = new Date().toISOString().slice(0, 10)

  for (const c of contacts) {
    const refDate = lastReportByContact[c.id] || lastDoneByContact[c.id] || c.assignment_date || c.first_visit_date || c.created_at
    if (daysSince(refDate) < RELANCE_INTERVAL_DAYS) continue

    const integratorIds = [...new Set((c.integrators || []).map(i => i.integrator_id).filter(Boolean))]
    if (!integratorIds.length) continue

    const fullName = `${c.first_name} ${c.last_name}`
    for (const integratorId of integratorIds) {
      const key = `${c.id}:${integratorId}`
      if (pendingSet.has(key)) continue
      rows.push({
        contact_id: c.id,
        assigned_to: integratorId,
        type: 'relance_nouvelles',
        title: `Prendre des nouvelles de ${fullName}`,
        priority: 'normal',
        due_date: today,
        auto_created: true,
      })
    }
  }

  if (rows.length) {
    const { error } = await supabase.from('tasks').insert(rows)
    if (error) { console.error('Erreur insertion relances_nouvelles:', error); return { checked: 'relances_nouvelles', created: 0, error: error.message } }
  }

  return { checked: 'relances_nouvelles', created: rows.length }
}

// Champs consideres comme "a completer" — memes champs que le panneau
// de completude dans NewcomerReportPanel, pour rester coherent.
const COMPLETENESS_FIELDS = [
  'date_of_birth', 'email', 'whatsapp', 'address', 'commune', 'quartier',
  'situation', 'interests', 'availability', 'how_found', 'prayer_request',
]

function isMissing(value) {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim() === ''
  return false
}

// Garde-fou n°2 : rappel doux si la fiche reste incomplete (champs
// manquants) OU si l'integrateur n'a toujours jamais enregistre de
// compte-rendu, quel que soit le temps ecoule. Un seul rappel actif a la
// fois par contact + integrateur (pas de doublon tant qu'il n'est pas traite).
async function checkFichesIncompletes(supabase) {
  const fieldsSelect = COMPLETENESS_FIELDS.join(', ')
  const { data: contacts } = await supabase
    .from('contacts')
    .select(`id, first_name, last_name, integrator_contacted, ${fieldsSelect}, integrators:contact_integrators(integrator_id)`)
    .eq('status', 'active')
    .eq('hors_territoire', false)
    .neq('contact_preference', 'none')
    .not('stage', 'in', `(${STOP_STAGES.join(',')})`)

  if (!contacts?.length) return { checked: 'fiches_incompletes', created: 0 }

  const contactIds = contacts.map(c => c.id)
  const { data: pending } = await supabase
    .from('tasks')
    .select('contact_id, assigned_to')
    .eq('type', 'fiche_incomplete')
    .eq('status', 'pending')
    .in('contact_id', contactIds)
  const pendingSet = new Set((pending || []).map(t => `${t.contact_id}:${t.assigned_to}`))

  const rows = []
  const today = new Date().toISOString().slice(0, 10)

  for (const c of contacts) {
    const missingFields = COMPLETENESS_FIELDS.filter(f => isMissing(c[f]))
    const neverContacted = !c.integrator_contacted
    if (!missingFields.length && !neverContacted) continue

    const integratorIds = [...new Set((c.integrators || []).map(i => i.integrator_id).filter(Boolean))]
    if (!integratorIds.length) continue

    const fullName = `${c.first_name} ${c.last_name}`
    for (const integratorId of integratorIds) {
      const key = `${c.id}:${integratorId}`
      if (pendingSet.has(key)) continue
      rows.push({
        contact_id: c.id,
        assigned_to: integratorId,
        type: 'fiche_incomplete',
        title: `Compléter la fiche de ${fullName}`,
        priority: 'normal',
        due_date: today,
        auto_created: true,
      })
    }
  }

  if (rows.length) {
    const { error } = await supabase.from('tasks').insert(rows)
    if (error) { console.error('Erreur insertion fiches_incompletes:', error); return { checked: 'fiches_incompletes', created: 0, error: error.message } }
  }

  return { checked: 'fiches_incompletes', created: rows.length }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  const results = await Promise.all([
    checkRelancesNouvelles(supabase),
    checkFichesIncompletes(supabase),
  ])

  return NextResponse.json({ success: true, results })
}
