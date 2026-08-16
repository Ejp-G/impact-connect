// lib/suivi-priority.js
//
// Source UNIQUE de vérité pour la priorisation du module Suivi & Tâches.
// Tout est recalculé à la volée à partir des données déjà chargées par
// SuiviPage (contacts, tasks, contact_needs, integrator_reports) —
// aucune colonne stockée, aucune migration.

const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']
const ADVANCED_STAGES = ['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader']

export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

// Exportée : utilisée maintenant aussi par getContactStatus et par
// SuiviClient pour comparer une next_contact_date au jour courant.
export function toDateOnly(str) {
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

export function groupNeedsByContact(needs) {
  const map = {}
  needs.forEach(n => { (map[n.contact_id] = map[n.contact_id] || []).push(n) })
  return map
}
export function getAccompagnementFlag(contactId, needsByContact) {
  const needs = needsByContact[contactId] || []
  return needs.some(n => n.status === 'a_traiter' || n.status === 'en_cours')
}

export function isNeverContacted(contact) {
  return !contact.integrator_contacted
}

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

// --- NOUVEAU (point 3) : statut réel affiché comme badge "Urgence" ------
// Remplace contacts.alert_level (recalculé une seule fois par nuit, donc
// figé toute la journée) par une lecture temps réel : jamais contacté →
// rouge ; contacté mais échéance dépassée → rouge ; contacté, rien
// d'urgent aujourd'hui mais rien de prévu → orange ; prochaine action
// prévue dans le futur → blanc/gris ; stade avancé → vert. Le rouge ne
// reste donc plus affiché après un contact réel, contrairement à
// alert_level qui ne se met à jour qu'au cron du lendemain matin.
export function getContactStatus(contact, lastReport, today = new Date()) {
  if (ADVANCED_STAGES.includes(contact.stage)) {
    return { key: 'engage', emoji: '🟢', label: 'Parcours engagé' }
  }
  if (!contact.integrator_contacted) {
    return { key: 'a_contacter', emoji: '🔴', label: 'À contacter' }
  }
  const now = new Date(today); now.setHours(0, 0, 0, 0)
  const nextDate = lastReport?.next_contact_date ? toDateOnly(lastReport.next_contact_date) : null
  if (nextDate && nextDate < now) {
    return { key: 'a_contacter', emoji: '🔴', label: 'À relancer' }
  }
  if (nextDate && sameDate(nextDate, now)) {
    return { key: 'en_cours', emoji: '🟠', label: "À recontacter aujourd'hui" }
  }
  if (nextDate && nextDate > now) {
    return { key: 'attente', emoji: '⚪', label: 'En attente' }
  }
  return { key: 'en_cours', emoji: '🟠', label: 'Contact établi' }
}

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

// --- NOUVEAU : "en retard" limité aux contacts récents ---------------------
// Clarification métier essentielle : une tâche techniquement dépassée
// (due_date < today) ne doit compter comme "en retard" — et donc créer
// un sentiment d'urgence pour l'intégrateur — QUE si le contact associé
// est encore récent (catégorie "prioritaire" ou "normal", donc arrivé ce
// mois-ci ou le mois précédent). Un contact de plus de 2 mois
// ("a_reprendre") dont une vieille tâche traîne ne doit JAMAIS remonter
// comme "en retard" : cette ancienneté relève d'une logique de relance
// bienveillante, pas d'urgence. On ne fait ici que trier la même donnée
// (getTaskState) selon un second critère (getContactCategory) — aucune
// des deux fonctions existantes n'est modifiée.
export function isTaskTrulyOverdue(task, contact, today = new Date()) {
  if (getTaskState(task, today) !== 'a_relancer') return false
  const category = getContactCategory(contact, today)
  return category === 'prioritaire' || category === 'normal'
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
