// lib/suivi-priority.js
//
// Source UNIQUE de vérité pour la priorisation du module Suivi & Tâches
// (refonte "Ma journée"). Tout est recalculé à la volée à partir des
// données déjà chargées par SuiviPage (contacts, tasks, contact_needs,
// integrator_reports) — aucune colonne stockée, aucune migration.
//
// Ce fichier ne touche PAS à :
// - contacts.alert_level (toujours mis à jour par le cron quotidien
//   update_alerts_and_scores, utilisé ailleurs dans l'app, ex. dashboard)
// - tasks.priority (toujours posé tel quel par relance-nouvelles /
//   fiche_incomplete, jamais modifié ici)

const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']

// --- Semaine -----------------------------------------------------------
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

function sameDate(a, b) {
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

// --- Catégorie de suivi (sections 6-8, 27-28) ---------------------------
export function getContactCategory(contact, today = new Date()) {
  const refDate = toDateOnly(contact.first_visit_date) || toDateOnly(contact.created_at)
  if (!refDate) return 'normal'

  const now = new Date(today)
  now.setHours(0, 0, 0, 0)

  const startOfThisWeek = getWeekStart(now)
  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)
  if (refDate >= startOfLastWeek) return 'prioritaire'

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  if (refDate >= startOfLastMonth) return 'normal'

  return 'a_reprendre'
}

// --- État d'une tâche (section 11) --------------------------------------
export function getTaskState(task, today = new Date()) {
  if (task.status === 'done') return 'termine'
  const due = toDateOnly(task.due_date)
  const now = new Date(today); now.setHours(0, 0, 0, 0)
  if (due && due < now) return 'a_relancer'
  return 'dans_les_delais'
}

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

// --- NOUVEAU : action du jour --------------------------------------------
// Regroupe les comptes-rendus (integrator_reports) par contact, pour
// savoir si une action a déjà été enregistrée AUJOURD'HUI — c'est ce
// signal, et non la catégorie (qui ne change jamais dans la journée),
// qui doit faire avancer la progression de "Ma journée".
export function groupReportsByContact(reports) {
  const map = {}
  reports.forEach(r => {
    const list = (map[r.contact_id] = map[r.contact_id] || [])
    list.push(r)
  })
  return map
}

export function wasHandledToday(contactId, reportsByContact, today = new Date()) {
  const list = reportsByContact[contactId]
  if (!list || !list.length) return false
  const now = new Date(today); now.setHours(0, 0, 0, 0)
  return list.some(r => sameDate(toDateOnly(r.contacted_at), now))
}

// --- File de priorité (section 14) ----------------------------------------
// reports est optionnel pour ne pas casser d'anciens appels — sans lui,
// wasHandledToday retombe toujours à false (comportement d'avant ce
// correctif).
const RANK = {
  never_contacted: 0, prioritaire: 1, accompagnement: 2,
  a_relancer: 3, normal: 4, a_reprendre: 5,
}

export function buildPriorityQueue(contacts, tasks, needs, reports = [], today = new Date()) {
  const pendingByContact = groupPendingTasksByContact(tasks, today)
  const needsByContact = groupNeedsByContact(needs)
  const reportsByContact = groupReportsByContact(reports)

  return contacts
    .filter(c => !STOP_STAGES.includes(c.stage))
    .map(c => {
      const category = getContactCategory(c, today)
      const neverContacted = isNeverContacted(c)
      const accompagnement = getAccompagnementFlag(c.id, needsByContact)
      const pending = pendingByContact[c.id]
      const hasOverdueTask = pending?.worstState === 'a_relancer'
      const handledToday = wasHandledToday(c.id, reportsByContact, today)

      let reason = 'normal'
      if (neverContacted) reason = 'never_contacted'
      else if (category === 'prioritaire') reason = 'prioritaire'
      else if (accompagnement) reason = 'accompagnement'
      else if (hasOverdueTask) reason = 'a_relancer'
      else if (category === 'normal') reason = 'normal'
      else reason = 'a_reprendre'

      // needsAction : ce qui détermine réellement si la personne compte
      // encore dans "Ma journée". Contrairement à `reason` (qui sert au
      // classement par catégorie dans "Mon suivi"), needsAction devient
      // false dès qu'un compte-rendu a été enregistré aujourd'hui, même
      // si la catégorie sous-jacente (ex: "prioritaire") reste la même
      // jusqu'au lendemain.
      const actionableReasons = ['never_contacted', 'prioritaire', 'accompagnement', 'a_relancer']
      const needsAction = actionableReasons.includes(reason) && !handledToday

      return {
        contact: c,
        category,
        neverContacted,
        accompagnement,
        hasOverdueTask,
        handledToday,
        pendingTasks: pending?.tasks || [],
        reason,
        needsAction,
        rank: RANK[reason],
      }
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      const da = toDateOnly(a.contact.first_visit_date) || toDateOnly(a.contact.created_at) || new Date(0)
      const db = toDateOnly(b.contact.first_visit_date) || toDateOnly(b.contact.created_at) || new Date(0)
      return da - db
    })
}

export function getDailyMission(queue, size = 5) {
  return queue.slice(0, size)
}

export function buildWorkload(contacts, tasks, needs, reports = [], today = new Date()) {
  const queue = buildPriorityQueue(contacts, tasks, needs, reports, today)
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
