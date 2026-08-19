// lib/push-weekly.js
//
// Logique de calcul pour les notifications push hebdomadaires des
// intégrateurs (Dimanche = attribution, Mardi = premier rappel,
// Jeudi = dernière relance). Rien n'est stocké en dur : tout est
// recalculé à partir de contact_integrators + contacts, exactement
// comme suivi-priority.js le fait pour Suivi & Tâches.
//
// "Contacté" = contacts.integrator_contacted — même source de vérité
// que suivi-priority.js (isNeverContacted). Ne jamais créer un
// deuxième système parallèle.

import { PUSH_TIMEZONE } from './push-schedule'

const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']

// -- Dates (fuseau Guadeloupe) -----------------------------------------

export function guadeloupeDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PUSH_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Plage UTC correspondant à une journée civile en Guadeloupe (UTC-4 fixe).
export function guadeloupeDayRangeUTC(dateStr) {
  const start = `${dateStr}T04:00:00.000Z`
  const end = `${addDays(dateStr, 1)}T04:00:00.000Z`
  return { start, end }
}

// -- Données ------------------------------------------------------------

// Jeunes attribués (contact_integrators.assigned_at) au cours de la
// journée civile `dateStr` (Guadeloupe), groupés par intégrateur.
// Retourne { [integrator_id]: { count, contactIds: [] } }
export async function getAssignmentsForDay(supabase, dateStr) {
  const { start, end } = guadeloupeDayRangeUTC(dateStr)
  const { data, error } = await supabase
    .from('contact_integrators')
    .select('integrator_id, contact_id, assigned_at')
    .gte('assigned_at', start)
    .lt('assigned_at', end)
  if (error) throw error

  const byIntegrator = {}
  for (const row of data || []) {
    if (!row.integrator_id) continue
    const entry = (byIntegrator[row.integrator_id] = byIntegrator[row.integrator_id] || { count: 0, contactIds: [] })
    entry.count++
    entry.contactIds.push(row.contact_id)
  }
  return byIntegrator
}

// Parmi les jeunes attribués un dimanche donné (`sundayStr`), lesquels
// restent non contactés aujourd'hui — groupés par intégrateur. Exclut
// hors_territoire / "ne pas contacter" / stages avancés, comme le
// reste du suivi (mêmes règles que relance-nouvelles.js).
export async function getUncontactedFromSunday(supabase, sundayStr) {
  const assignments = await getAssignmentsForDay(supabase, sundayStr)
  const allContactIds = [...new Set(Object.values(assignments).flatMap(a => a.contactIds))]
  if (!allContactIds.length) return {}

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, integrator_contacted, hors_territoire, contact_preference, stage, status')
    .in('id', allContactIds)
  if (error) throw error

  const eligibleUncontacted = new Set(
    (contacts || [])
      .filter(c =>
        c.status === 'active' &&
        !c.integrator_contacted &&
        !c.hors_territoire &&
        c.contact_preference !== 'none' &&
        !STOP_STAGES.includes(c.stage)
      )
      .map(c => c.id)
  )

  const result = {}
  for (const [integratorId, entry] of Object.entries(assignments)) {
    const stillUncontacted = entry.contactIds.filter(id => eligibleUncontacted.has(id))
    if (stillUncontacted.length) result[integratorId] = stillUncontacted.length
  }
  return result
}
