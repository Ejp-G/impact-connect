// lib/suivi-priority.js
//
// Source UNIQUE de vérité pour la priorisation du module Suivi & Tâches.
// Tout est recalculé à la volée à partir des données déjà chargées par
// SuiviPage (contacts, tasks, contact_needs, integrator_reports) —
// aucune colonne stockée, aucune migration.

const STOP_STAGES = ['parcours', 'bapteme', 'service', 'leader_pot', 'leader']
const ADVANCED_STAGES = ['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader']

// Délai par défaut appliqué quand "En attente de réponse" est
// sélectionné sans date de relance précisée manuellement.
export const DEFAULT_RELANCE_DELAY_DAYS = 5

export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

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

// "Ne pas contacter" : réutilise contact_preference déjà existant sur
// contacts. Recouvre aussi "À porter dans la prière" — même situation
// vue sous deux angles (préférence de contact = aucune sollicitation).
export function isDoNotContact(contact) {
  return contact?.contact_preference === 'none'
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

// --- Statut réel du contact (badge affiché partout) ------------------
// Distingue "À relancer" (rose, échéance de relance dépassée) de
// "À contacter" (rouge, jamais contacté). "En attente de réponse"
// (violet) est un statut explicite entre les deux. "À porter dans la
// prière" prime sur tout le reste : une personne qui ne veut plus être
// contactée ne doit jamais remonter comme "à contacter"/"à relancer".
export function getContactStatus(contact, lastReport, today = new Date()) {
  if (isDoNotContact(contact)) {
    return { key: 'priere', emoji: '🙏', label: 'À porter dans la prière', icon: 'HeartHandshake' }
  }
  if (ADVANCED_STAGES.includes(contact.stage)) {
    return { key: 'engage', emoji: '🟢', label: 'Parcours engagé', icon: 'CheckCircle2' }
  }
  if (!contact.integrator_contacted) {
    return { key: 'a_contacter', emoji: '🔴', label: 'À contacter', icon: 'AlertCircle' }
  }
  const now = new Date(today); now.setHours(0, 0, 0, 0)
  const nextDate = lastReport?.next_contact_date ? toDateOnly(lastReport.next_contact_date) : null
  if (nextDate && nextDate < now) {
    return { key: 'a_relancer', emoji: '🩷', label: 'À relancer', icon: 'RotateCcw' }
  }
  if (nextDate && sameDate(nextDate, now)) {
    return { key: 'a_relancer', emoji: '🩷', label: "À recontacter aujourd'hui", icon: 'RotateCcw' }
  }
  if (nextDate && nextDate > now) {
    return { key: 'en_attente', emoji: '🟣', label: 'En attente de réponse', icon: 'Clock' }
  }
  return { key: 'en_cours', emoji: '🟠', label: 'Contact établi', icon: 'Send' }
}

const RANK = {
  never_contacted: 0, prioritaire: 1, accompagnement: 2,
  a_relancer: 3, en_attente: 4, normal: 5, a_reprendre: 6, priere: 7,
}

export function buildPriorityQueue(contacts, tasks, needs, reports = [], today = new Date()) {
  const pendingByContact = groupPendingTasksByContact(tasks, today)
  const needsByContact = groupNeedsByContact(needs)
  const reportsByContact = groupReportsByContact(reports)

  return contacts
    // "Ne pas contacter" exclut du suivi actif au même titre que
    // hors_territoire et STOP_STAGES.
    .filter(c => !STOP_STAGES.includes(c.stage) && !c.hors_territoire && !isDoNotContact(c))
    .map(c => {
      const category = getContactCategory(c, today)
      const neverContacted = isNeverContacted(c)
      const accompagnement = getAccompagnementFlag(c.id, needsByContact)
      const pending = pendingByContact[c.id]
      const hasOverdueTask = pending?.worstState === 'a_relancer'
      const handledToday = wasHandledToday(c.id, reportsByContact, today)
      const lastReport = reportsByContact[c.id]?.[0]
      const status = getContactStatus(c, lastReport, today)

      let reason = 'normal'
      if (neverContacted) reason = 'never_contacted'
      else if (category === 'prioritaire') reason = 'prioritaire'
      else if (accompagnement) reason = 'accompagnement'
      else if (status.key === 'a_relancer' || hasOverdueTask) reason = 'a_relancer'
      else if (status.key === 'en_attente') reason = 'en_attente'
      else if (category === 'normal') reason = 'normal'
      else reason = 'a_reprendre'

      // "en_attente" (violet) est volontairement EXCLU des raisons
      // actionnables : on attend une réponse, rien à faire tant que
      // l'échéance n'est pas dépassée. Elle bascule en "a_relancer"
      // automatiquement au jour J+1 via getContactStatus.
      const actionableReasons = ['never_contacted', 'prioritaire', 'accompagnement', 'a_relancer']
      const needsAction = actionableReasons.includes(reason) && !handledToday

      return {
        contact: c,
        category,
        neverContacted,
        accompagnement,
        hasOverdueTask,
        handledToday,
        status,
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
      if (item.hasOverdueTask || item.status?.key === 'a_relancer') entry.a_relancer++
      if (item.category === 'a_reprendre') entry.a_reprendre++
    })
  })
  return Object.entries(byIntegrator)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
}

// "En retard" reste réservé aux tâches réelles (module Tâches).
export function isTaskTrulyOverdue(task, contact, today = new Date()) {
  if (contact?.hors_territoire) return false
  if (isDoNotContact(contact)) return false
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
  a_relancer: { emoji: '🩷', label: 'À relancer' },
  termine: { emoji: '✅', label: 'Terminé' },
}
export const REASON_LABEL = {
  never_contacted: { emoji: '🚨', label: 'Nouveau contact non contacté' },
  prioritaire: { emoji: '🔥', label: 'Prioritaire à contacter' },
  accompagnement: { emoji: '❤️', label: 'À accompagner' },
  a_relancer: { emoji: '🩷', label: 'À relancer' },
  en_attente: { emoji: '🟣', label: 'En attente de réponse' },
  normal: { emoji: '🟢', label: 'Suivi normal' },
  a_reprendre: { emoji: '📚', label: 'À reprendre' },
}

// Couleurs réelles associées à chaque clé de statut — un seul endroit,
// consommé par SuiviClient/VisiteursClient/ContactProfileClient plutôt
// que de redéfinir la palette à chaque fichier.
export const STATUS_COLORS = {
  a_contacter: { bg: '#FEF2F2', color: '#DC2626' },
  a_relancer:  { bg: '#FDF2F8', color: '#DB2777' },
  en_attente:  { bg: '#F5F3FF', color: '#7C3AED' },
  en_cours:    { bg: '#FFF7ED', color: '#C2410C' },
  priere:      { bg: '#F5F3FF', color: '#6D28D9' },
  engage:      { bg: '#F0FDF4', color: '#16A34A' },
  attente:     { bg: '#F8FAFC', color: '#64748B' },
}
