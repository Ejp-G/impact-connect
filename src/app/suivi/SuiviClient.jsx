'use client'
import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PRIORITY_COLORS, STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import NewcomerReportPanel from '@/components/suivi/NewcomerReportPanel'
import NeedsDrilldownModal from '@/components/suivi/NeedsDrilldownModal'
import ExportModal from '@/components/suivi/ExportModal'
import { Users, CheckSquare, Compass, NEED_ICON_MAP, Download, Filter } from '@/lib/icons'

const FILTERS = [
  ['all', 'Tous'], ['today', 'À contacter aujourd\'hui'], ['late', 'En retard'],
  ['new', 'Nouveaux'], ['salvation', 'Prière du salut'], ['reconciliation', 'Réconciliation'],
  ['no_integrator', 'Sans intégrateur'], ['male', 'Homme'], ['female', 'Femme'],
  ['fi_yes', 'FI attribuée'], ['fi_no', 'FI non attribuée'],
]

// Libelles doux pour les taches auto-generees par les relances
// bienveillantes (voir app/api/cron/relance-nouvelles) — remplace le
// nom technique du type par un texte chaleureux, sans rouge ni ton
// alarmant, conformement au principe "gentil" demande.
const TASK_TYPE_LABELS = {
  relance_nouvelles: '💌 Prendre des nouvelles',
  fiche_incomplete: '📋 Fiches à compléter',
}

function AlertDot({ level }) {
  const color = level === 'red' ? '#EF4444' : level === 'orange' ? '#F97316' : '#22C55E'
  return <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:color }} />
}

// Compare uniquement les chiffres, pour que "06 90 13 70", "0690-13-70"
// ou "06901370" tapes dans la recherche retrouvent le meme contact,
// quel que soit le format exact enregistre dans phone.
function digitsOnly(str) {
  return (str || '').replace(/\D/g, '')
}

export default function SuiviClient({ contacts, reports, needs, allNeeds = [], canViewNeedsBoard = false, tasks: initialTasks, profiles = [], profile, canViewTeam = false, canViewIndividuals = false, suiviTeam = [], viewAs = 'me', fis = [], communes = [] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'nouveaux')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('all') // all|today|week|month|year|sunday
  const [sundayDate, setSundayDate] = useState('')
  const [openMonths, setOpenMonths] = useState({})

  const [reportPanelId, setReportPanelId] = useState(null)
  const [drilldownCategory, setDrilldownCategory] = useState(null)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskGroupByVisitor, setTaskGroupByVisitor] = useState(false)
  const [openFolders, setOpenFolders] = useState({})
  const [showExport, setShowExport] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const [tasks, setTasks] = useState(initialTasks)

  const latestReportByContact = useMemo(() => {
    const map = {}
    reports.forEach(r => {
      if (!map[r.contact_id] || new Date(r.contacted_at) > new Date(map[r.contact_id].contacted_at)) {
        map[r.contact_id] = r
      }
    })
    return map
  }, [reports])

  const needsByContact = useMemo(() => {
    const map = {}
    needs.forEach(n => { (map[n.contact_id] = map[n.contact_id] || []).push(n) })
    return map
  }, [needs])

  const today = new Date().toISOString().slice(0, 10)

  const filteredContacts = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
    const weekStr = startOfWeek.toISOString().slice(0, 10)
    const monthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const yearStr = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)

    const q = search.trim().toLowerCase()
    const qDigits = digitsOnly(search)

    return contacts.filter(c => {
      if (q) {
        const nameMatch = `${c.first_name} ${c.last_name} ${c.commune || ''}`.toLowerCase().includes(q)
        // On exige au moins 3 chiffres dans la recherche avant de tenter
        // un match telephone, pour eviter les faux positifs sur une
        // recherche courte type "12".
        const phoneMatch = qDigits.length >= 3 && digitsOnly(c.phone).includes(qDigits)
        if (!nameMatch && !phoneMatch) return false
      }

      const lastReport = latestReportByContact[c.id]
      const contactNeeds = needsByContact[c.id] || []
      const hasIntegrators = (c.integrators || []).length > 0

      if (periodFilter === 'today' && c.first_visit_date !== today) return false
      if (periodFilter === 'week' && !(c.first_visit_date >= weekStr)) return false
      if (periodFilter === 'month' && !(c.first_visit_date >= monthStr)) return false
      if (periodFilter === 'year' && !(c.first_visit_date >= yearStr)) return false
      if (periodFilter === 'sunday' && sundayDate && c.first_visit_date !== sundayDate) return false

      if (filter === 'today') return lastReport?.next_contact_date === today
      if (filter === 'late') return lastReport?.next_contact_date && lastReport.next_contact_date < today
      if (filter === 'new') {
        const days = (Date.now() - new Date(c.first_visit_date || c.created_at).getTime()) / 86400000
        return days <= 7
      }
      if (filter === 'salvation') return c.salvation_call === true
      if (filter === 'reconciliation') return contactNeeds.some(n => n.category === 'reconciliation')
      if (filter === 'no_integrator') return !hasIntegrators
      if (filter === 'male') return c.sex === 'M'
      if (filter === 'female') return c.sex === 'F'
      if (filter === 'fi_yes') return !!c.fi
      if (filter === 'fi_no') return !c.fi
      return true
    })
  }, [contacts, filter, search, periodFilter, sundayDate, latestReportByContact, needsByContact, today])

  function changeFilter(f) { setFilter(f) }
  function changeSearch(v) { setSearch(v) }

  function changeViewAs(v) {
    const params = new URLSearchParams(searchParams.toString())
    if (v === 'me') params.delete('viewAs')
    else params.set('viewAs', v)
    router.push(`/suivi?${params.toString()}`)
  }

  // Regroupement chronologique par mois d'arrivee (first_visit_date).
  // Ordre le plus recent en premier ; seul le mois en cours est ouvert
  // par defaut, sauf si une recherche trouve une correspondance ailleurs.
  const INTEGRATED_STAGES = ['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader']
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  const monthGroups = useMemo(() => {
    const map = {}
    filteredContacts.forEach(c => {
      const d = c.first_visit_date ? new Date(c.first_visit_date) : null
      const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'inconnue'
      ;(map[key] = map[key] || []).push(c)
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const [year, month] = key.split('-')
        const label = key === 'inconnue' ? 'Date inconnue' : `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
        const integres = items.filter(c => INTEGRATED_STAGES.includes(c.stage)).length
        const suivis = items.filter(c => !INTEGRATED_STAGES.includes(c.stage)).length
        const parcoursTermines = items.filter(c => ['parcours','bapteme','service','leader_pot','leader'].includes(c.stage)).length
        return { key, label, items, integres, suivis, parcoursTermines }
      })
  }, [filteredContacts])

  const searchMatchedMonthKeys = useMemo(() => {
    if (!search.trim()) return new Set()
    return new Set(monthGroups.filter(g => g.items.length > 0).map(g => g.key))
  }, [search, monthGroups])

  function isMonthOpen(key) {
    if (search.trim() && searchMatchedMonthKeys.has(key)) return true
    if (openMonths[key] !== undefined) return openMonths[key]
    return key === currentMonthKey
  }
  function toggleMonth(key) {
    setOpenMonths(prev => ({ ...prev, [key]: !isMonthOpen(key) }))
  }

  // Tableau intelligent des besoins : donnees NON filtrees par
  // portefeuille quand canViewNeedsBoard (equipe_suivi, superviseur,
  // responsable_suivi) — c'est un outil collaboratif, pas personnel.
  const needsSummary = useMemo(() => {
    const source = canViewNeedsBoard ? allNeeds : []
    const byCategory = {}
    source.forEach(n => {
      if (!byCategory[n.category]) byCategory[n.category] = []
      byCategory[n.category].push(n)
    })
    return NEED_CATEGORIES.map(cat => {
      const rows = byCategory[cat.id] || []
      const enCours = rows.filter(r => r.status === 'en_cours').length
      const aTraiter = rows.filter(r => r.status === 'a_traiter').length
      const uniqueContacts = new Set(rows.map(r => r.contact_id)).size
      let dot = '#94A3B8'
      if (aTraiter > 0) dot = '#EF4444'
      else if (enCours > 0) dot = '#F97316'
      else if (rows.length > 0) dot = '#22C55E'
      return { ...cat, count: uniqueContacts, actionsEnCours: enCours, dot, hasData: rows.length > 0 }
    }).filter(c => c.hasData)
  }, [allNeeds, canViewNeedsBoard])

  async function toggleLegacyTask(e, id) {
    e.stopPropagation()
    const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'done' }) })
    if (res.ok) { setTasks(prev => prev.filter(t => t.id !== id)); router.refresh() }
  }

  // Boite de reception intelligente : regroupe les taches en dossiers
  // (Urgentes en premier, quel que soit le type, puis un dossier par
  // type distinct). Une tache urgente n'apparait que dans "Urgentes"
  // pour eviter un doublon visuel entre deux dossiers. Le libelle du
  // dossier passe par TASK_TYPE_LABELS quand il existe, pour afficher
  // un texte doux plutot que le type technique brut (relance_nouvelles,
  // fiche_incomplete...).
  const taskFolders = useMemo(() => {
    const q = taskSearch.toLowerCase()
    const qDigits = digitsOnly(taskSearch)
    const filtered = tasks.filter(t => {
      if (!q) return true
      const name = `${t.contact?.first_name || ''} ${t.contact?.last_name || ''}`.toLowerCase()
      const textMatch = name.includes(q) || (t.title || '').toLowerCase().includes(q) || (t.type || '').toLowerCase().includes(q)
      const phoneMatch = qDigits.length >= 3 && digitsOnly(t.contact?.phone).includes(qDigits)
      return textMatch || phoneMatch
    })
    const urgentes = filtered.filter(t => t.priority === 'urgent')
    const byType = {}
    filtered.forEach(t => {
      if (t.priority === 'urgent') return
      const key = t.type || 'Autre'
      ;(byType[key] = byType[key] || []).push(t)
    })
    const folders = []
    if (urgentes.length) folders.push({ key: 'urgentes', label: '🚨 Urgentes', items: urgentes })
    Object.entries(byType).forEach(([type, items]) => folders.push({ key: type, label: TASK_TYPE_LABELS[type] || type, items }))
    return folders
  }, [tasks, taskSearch])

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['nouveaux', 'Suivi des nouveaux', Users], ['taches', 'Tâches', CheckSquare]].map(([id, label, Icon]) => (
