// lib/suivi-priority.js
//
// Source UNIQUE de vérité pour la priorisation du module Suivi & Tâches
// (refonte "Ma mission"). Tout est recalculé à la volée à partir des
// données déjà chargées par SuiviPage (contacts, tasks, contact_needs) —
// aucune colonne stockée, aucune migration.
//
// Ce fichier ne touche PAS à :
// - contacts.alert_level (toujours mis à jour par le cron quotidien
//   update_alerts_and_scores, utilisé ailleurs dans l'app, ex. dashboard)
// - tasks.priority (toujours posé tel quel par relance-nouvelles /
//   fiche_incomplete, jamais modifié ici)
// Il ajoute une lecture parallèle, dédiée à l'expérience "Ma mission".

const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']

// --- Semaine -----------------------------------------------------------
// La semaine de suivi commence le dimanche (section 27), pas le lundi —
// pour coller au rythme de l'église (culte du dimanche).
export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // getDay(): 0 = dimanche
  return d
}

function toDateOnly(str) {
  if (!str) return null
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

// --- Catégorie de suivi (sections 6-8, 27-28) ---------------------------
// Basée uniquement sur l'ancienneté (first_visit_date, sinon created_at
// en repli si la date de première visite n'est pas renseignée — donnée
// manquante = ne jamais planter, voir section 40).
export function getContactCategory(contact, today = new Date()) {
  const refDate = toDateOnly(contact.first_visit_date) || toDateOnly(contact.created_at)
  if (!refDate) return 'normal'

  const now = new Date(today)
  now.setHours(0, 0, 0, 0)

  // Prioritaire : dimanche de la semaine en cours -> aujourd'hui,
  // OU dimanche de la semaine précédente -> samedi précédent.
  const startOfThisWeek = getWeekStart(now)
  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)
  if (refDate >= startOfLastWeek) return 'prioritaire'

  // Normal : mois en cours + mois précédent (hors fenêtre prioritaire
  // déjà traitée au-dessus).
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  if (refDate >= startOfLastMonth) return 'normal'

  // À reprendre : plus de deux mois.
  return 'a_reprendre'
}

// --- État d'une tâche (section 11) --------------------------------------
// Recalculé depuis due_date + status à chaque appel — jamais depuis
// tasks.priority (champ stocké non fiable, voir diagnostic de la refonte).
export function getTaskState(task, today = new Date()) {
  if (task.status === 'done') return 'termine'
  const due = toDateOnly(task.due_date)
  const now = new Date(today); now.setHours(0, 0, 0, 0)
  if (due && due < now) return 'a_relancer'
  return 'dans_les_delais'
}

// Regroupe les tâches EN ATTENTE par contact, avec le pire état
// rencontré ("a_relancer" prime toujours sur "dans_les_delais").
export function groupPendingTasksByContact(tasks, today = new Date()) {
  const map = {}
  tasks.forEach(t => {
    if (t.status !== 'pending') return
    const state = getTaskState(t, today)
    const entry = (map[t.contact_id] = map[t.contact_id] || { tasks: [], worstState: 'dans_les_delais' })
    entry.tasks.push({ ...t, state })
    if (state === 'a_relancer') entry.worstState = 'a_relancer'
  })
  return map
}

// --- Besoin d'accompagnement (section 13) --------------------------------
export function groupNeedsByContact(needs) {
  const map = {}
  needs.forEach(n => { (map[n.contact_id] = map[n.contact_id] || []).push(n) })
  return map
}
export function getAccompagnementFlag(contactId, needsByContact) {
  const needs = needsByContact[contactId] || []
  return needs.some(n => n.status === 'a_traiter' || n.status === 'en_cours')
}

// --- Premier contact (KPI section 31) -------------------------------------
export function isNeverContacted(contact) {
  return !contact.integrator_contacted
}

// --- File de priorité (section 14) ----------------------------------------
// Ordre : 1) jamais contacté  2) prioritaire  3) à accompagner
// 4) à relancer  5) normal  6) à reprendre.
// Les contacts à un stade avancé (STOP_STAGES) sortent de la file
// active — même logique que les crons relance-nouvelles/fiche_incomplete :
// au-delà, le suivi rapproché n'a plus lieu d'être.
const RANK = {
  never_contacted: 0, prioritaire: 1, accompagnement: 2,
  a_relancer: 3, normal: 4, a_reprendre: 5,
}

export function buildPriorityQueue(contacts, tasks, needs, today = new Date()) {
  const pendingByContact = groupPendingTasksByContact(tasks, today)
  const needsByContact = groupNeedsByContact(needs)

  return contacts
    .filter(c => !STOP_STAGES.includes(c.stage))
    .map(c => {
      const category = getContactCategory(c, today)
      const neverContacted = isNeverContacted(c)
      const accompagnement = getAccompagnementFlag(c.id, needsByContact)
      const pending = pendingByContact[c.id]
      const hasOverdueTask = pending?.worstState === 'a_relancer'

      let reason = 'normal'
      if (neverContacted) reason = 'never_contacted'
      else if (category === 'prioritaire') reason = 'prioritaire'
      else if (accompagnement) reason = 'accompagnement'
      else if (hasOverdueTask) reason = 'a_relancer'
      else if (category === 'normal') reason = 'normal'
      else reason = 'a_reprendre'

      return {
        contact: c,
        category,
        neverContacted,
        accompagnement,
        hasOverdueTask,
        pendingTasks: pending?.tasks || [],
        reason,
        rank: RANK[reason],
      }
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      // À rang égal : le plus ancien first_visit_date passe en premier
      // (celui qui attend depuis le plus longtemps).
      const da = toDateOnly(a.contact.first_visit_date) || toDateOnly(a.contact.created_at) || new Date(0)
      const db = toDateOnly(b.contact.first_visit_date) || toDateOnly(b.contact.created_at) || new Date(0)
      return da - db
    })
}

// --- Objectif quotidien (section 15-16) ------------------------------------
// Simple sous-ensemble de la file, jamais un filtre bloquant : le reste
// de la file reste accessible via "Voir d'autres contacts".
export function getDailyMission(queue, size = 5) {
  return queue.slice(0, size)
}

// --- Charge par intégrateur (section 18-19) ---------------------------------
// À utiliser uniquement dans la vue "toute l'équipe" (viewAs === 'all'),
// réservée aux rôles de supervision côté page serveur.
export function buildWorkload(contacts, tasks, needs, today = new Date()) {
  const queue = buildPriorityQueue(contacts, tasks, needs, today)
  const byIntegrator = {}

  queue.forEach(item => {
    const links = item.contact.integrators || []
    const targets = links.length
      ? links.map(l => ({ id: l.integrator?.id, name: l.integrator?.name }))
      : [{ id: 'non_assigne', name: 'Non assigné' }]

    targets.forEach(({ id, name }) => {
      if (!id) return
      const entry = (byIntegrator[id] = byIntegrator[id] || {
        name: name || '—', total: 0, prioritaire: 0, a_relancer: 0, a_reprendre: 0,
      })
      entry.total++
      if (item.category === 'prioritaire') entry.prioritaire++
      if (item.hasOverdueTask) entry.a_relancer++
      if (item.category === 'a_reprendre') entry.a_reprendre++
    })
  })

  return Object.entries(byIntegrator)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
}

// --- Libellés UI (sections 9-10) ---------------------------------------
// Vocabulaire "gentil" côté intégrateur : jamais "en retard" dans cette
// expérience. Les emails de task-overdue-alerts (destinés aux
// responsables) ne passent pas par ce fichier et restent inchangés.
export const CATEGORY_LABEL = {
  prioritaire: { emoji: '🔥', label: 'Prioritaire' },
  normal: { emoji: '🟢', label: 'Normal' },
  a_reprendre: { emoji: '📚', label: 'À reprendre' },
}
export const TASK_STATE_LABEL = {
  dans_les_delais: { emoji: '🟢', label: 'Dans les délais' },
  a_relancer: { emoji: '🟠', label: 'À relancer' },
  termine: { emoji: '✅', label: 'Terminé' },
}
export const REASON_LABEL = {
  never_contacted: { emoji: '🚨', label: 'Nouveau contact non contacté' },
  prioritaire: { emoji: '🔥', label: 'Prioritaire à contacter' },
  accompagnement: { emoji: '❤️', label: 'À accompagner' },
  a_relancer: { emoji: '🟠', label: 'À relancer' },
  normal: { emoji: '🟢', label: 'Suivi normal' },
  a_reprendre: { emoji: '📚', label: 'À reprendre' },
}
