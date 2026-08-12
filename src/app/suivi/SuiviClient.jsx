'use client'
import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import { getTaskState, TASK_STATE_LABEL } from '@/lib/suivi-priority'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import NewcomerReportPanel from '@/components/suivi/NewcomerReportPanel'
import NeedsDrilldownModal from '@/components/suivi/NeedsDrilldownModal'
import ExportModal from '@/components/suivi/ExportModal'
import ParcoursEnCoursTab from '@/components/suivi/ParcoursEnCoursTab'
import MissionTab from '@/components/suivi/MissionTab'
import WorkloadPanel from '@/components/suivi/WorkloadPanel'
import { Users, CheckSquare, Compass, NEED_ICON_MAP, Download, Filter } from '@/lib/icons'

function MissionIcon({ size = 18 }) {
  return <span style={{ fontSize: size, lineHeight: 1 }}>🎯</span>
}

const FILTERS = [
  ['all', 'Tous'], ['today', 'À contacter aujourd\'hui'], ['late', 'À relancer'],
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

export default function SuiviClient({ contacts, reports, needs, allNeeds = [], canViewNeedsBoard = false, tasks: initialTasks, profiles = [], profile, canViewTeam = false, canViewIndividuals = false, suiviTeam = [], viewAs = 'me', fis = [], communes = [], canViewParcours = false, parcoursList = [] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'mission')
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

  // Vue charge (sections 18-19) : uniquement en mode "toute l'équipe",
  // réservée aux rôles de supervision — jamais un simple intégrateur.
  const secondaryRoles = profile?.secondary_roles || []
  const canViewWorkload = canViewTeam && viewAs === 'all'
    && (['admin', 'superviseur', 'responsable_suivi'].includes(profile?.role) || secondaryRoles.includes('responsable_suivi'))

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
        {[['mission', 'Ma mission', MissionIcon], ['nouveaux', 'Suivi des nouveaux', Users], ['taches', 'Tâches', CheckSquare], ...(canViewParcours ? [['parcours', 'Parcours en cours', Compass]] : [])].map(([id, label, Icon]) => (
          <div key={id} onClick={() => setTab(id)} style={{
            padding: '13px 26px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 800,
            background: tab === id ? 'var(--n)' : '#fff', color: tab === id ? '#fff' : 'var(--gd)',
            border: tab === id ? 'none' : '2px solid var(--br)',
            boxShadow: tab === id ? '0 4px 14px rgba(11,61,145,.3)' : 'none',
            display: 'flex', alignItems: 'center', gap: 9
          }}>
            <Icon size={18} strokeWidth={2.2} /> {label}
          </div>
        ))}

        {canViewTeam && (
          <select value={viewAs} onChange={e => changeViewAs(e.target.value)} style={{ marginLeft: 'auto', padding: '9px 14px', borderRadius: 10, border: '1px solid var(--br)', fontSize: 12, fontFamily: 'inherit', background: '#fff', color: 'var(--gd)', fontWeight: 600 }}>
            <option value="me">👤 Mes tâches</option>
            {canViewIndividuals && suiviTeam.filter(m => m.id !== profile?.id).map(m => (
              <option key={m.id} value={m.id}>Tâches de {m.name}</option>
            ))}
            <option value="all">🌐 Toute l'équipe</option>
          </select>
        )}
      </div>

      {canViewTeam && viewAs !== 'me' && (
        <div style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          {viewAs === 'all' ? "Vous consultez les visiteurs et tâches de toute l'équipe." : `Vous consultez le portefeuille de ${suiviTeam.find(m => m.id === viewAs)?.name || 'ce membre'}.`}
        </div>
      )}

      {tab === 'mission' && (
        <div>
          {canViewWorkload && <WorkloadPanel contacts={contacts} tasks={tasks} needs={needs} />}
          <MissionTab
            contacts={contacts}
            tasks={tasks}
            needs={needs}
            profile={profile}
            onOpenReport={(id) => setReportPanelId(id)}
            onOpenProfile={(id) => router.push(`/visiteurs/${id}`)}
          />
        </div>
      )}

      {tab === 'nouveaux' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowExport(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} strokeWidth={2} /> Exporter
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--br)', borderRadius: 10, padding: '8px 14px' }}>
              <input value={search} onChange={e => changeSearch(e.target.value)} placeholder="Rechercher (nom ou téléphone)..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, width: 190 }} />
            </div>
            <div className="filter-chips-desktop" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(([id, label]) => (
                <div key={id} onClick={() => changeFilter(id)} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === id ? 'var(--n)' : '#F1F5F9', color: filter === id ? '#fff' : '#64748B'
                }}>
                  {label}
                </div>
              ))}
            </div>
            <div className="filter-btn-mobile" style={{ position: 'relative' }}>
              <button onClick={() => setShowFilterMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--br)', background: filter !== 'all' ? 'rgba(11,61,145,.08)' : '#fff', color: filter !== 'all' ? 'var(--n)' : 'var(--gd)', fontWeight: 600, fontSize: 13 }}>
                <Filter size={14} strokeWidth={2} /> Filtres
                {filter !== 'all' && <span style={{ background: 'var(--n)', color: '#fff', borderRadius: 999, fontSize: 10, padding: '1px 6px' }}>1</span>}
              </button>
              {showFilterMenu && (
                <div onClick={() => setShowFilterMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }}>
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 44, left: 0, background: '#fff', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.18)', padding: 10, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, maxHeight: '60vh', overflowY: 'auto' }}>
                    {FILTERS.map(([id, label]) => (
                      <div key={id} onClick={() => { changeFilter(id); setShowFilterMenu(false) }} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: filter === id ? 'var(--n)' : 'transparent', color: filter === id ? '#fff' : '#374151' }}>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--br)', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
              <option value="sunday">Dimanche de culte précis</option>
            </select>
            {periodFilter === 'sunday' && (
              <input type="date" value={sundayDate} onChange={e => setSundayDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--br)', fontSize: 12, fontFamily: 'inherit' }} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {monthGroups.map(g => {
              const open = isMonthOpen(g.key)
              return (
                <div key={g.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => toggleMonth(g.key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{open ? '▾' : '▸'} {g.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', background: '#EFF6FF', padding: '2px 10px', borderRadius: 999 }}>{g.items.length} visiteur(s)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--gy)' }}>
                      <span><b style={{ color: '#16A34A' }}>{g.integres}</b> intégrés</span>
                      <span><b style={{ color: '#3B82F6' }}>{g.suivis}</b> suivis</span>
                      <span><b style={{ color: '#F97316' }}>{g.parcoursTermines}</b> parcours</span>
                    </div>
                  </div>
                  {open && (
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>1ère visite</th><th>Nom</th><th>Sexe</th><th>Commune</th>
                            <th>Intégrateurs</th><th>Étape</th><th>Dernier contact</th>
                            <th>Prochain contact</th><th>Urgence</th><th>Score</th><th>FIJ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map(c => {
                            const lastReport = latestReportByContact[c.id]
                            const integratorNames = (c.integrators || []).map(i => i.integrator?.name).filter(Boolean)
                            const isMatch = search.trim() && `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
                            return (
                              <tr key={c.id} onClick={() => setReportPanelId(c.id)} style={{ cursor: 'pointer', background: isMatch ? '#FEF9C3' : undefined }}>
                                <td style={{ fontSize: 12 }}>{c.first_visit_date || '—'}</td>
                                <td style={{ fontSize: 13, fontWeight: 600 }}>{c.first_name} {c.last_name}</td>
                                <td style={{ fontSize: 12 }}>{c.sex}</td>
                                <td style={{ fontSize: 12 }}>{c.commune || '—'}</td>
                                <td style={{ fontSize: 11, color: integratorNames.length ? 'var(--gd)' : '#DC2626' }}>
                                  {integratorNames.length ? integratorNames.join(' & ') : 'Non assigné'}
                                </td>
                                <td><span className="badge" style={{ background: STAGE_COLOR(c.stage) + '20', color: STAGE_COLOR(c.stage) }}>{STAGE_LABEL(c.stage)}</span></td>
                                <td style={{ fontSize: 11 }}>{lastReport ? new Date(lastReport.contacted_at).toLocaleDateString('fr-FR') : (c.integrator_contacted ? '—' : 'Jamais')}</td>
                                <td style={{ fontSize: 11 }}>{lastReport?.next_contact_date || '—'}</td>
                                <td><AlertDot level={c.alert_level} /></td>
                                <td style={{ fontSize: 12, fontWeight: 700 }}>{c.integration_score ?? '—'}</td>
                                <td style={{ fontSize: 11 }}>{c.fi?.name || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            {monthGroups.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>Aucun résultat</div>
            )}
          </div>
        </div>
      )}

      {tab === 'taches' && (
        <div>
          {canViewNeedsBoard && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={16} strokeWidth={2} /> Tableau intelligent des besoins
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gy)', marginLeft: 4 }}>· toute l'équipe</span>
              </div>
              <table>
                <thead>
                  <tr><th>Besoin</th><th>Personnes</th><th>Actions en cours</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {needsSummary.map(cat => {
                    const Icon = NEED_ICON_MAP[cat.id]
                    return (
                      <tr key={cat.id} onClick={() => setDrilldownCategory(cat.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                          {Icon && <Icon size={14} strokeWidth={2} />} {cat.label}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--n)', textDecoration: 'underline' }}>{cat.count} — Voir la liste</td>
                        <td style={{ fontSize: 13 }}>{cat.actionsEnCours}</td>
                        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: cat.dot }} /></td>
                      </tr>
                    )
                  })}
                  {needsSummary.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--gy)' }}>Aucun besoin détecté pour le moment</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📥 Boîte de réception ({tasks.length})</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--br)', borderRadius: 8, padding: '5px 10px' }}>
                <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Rechercher (nom ou téléphone)..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12, width: 170 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gd)', cursor: 'pointer' }}>
                <input type="checkbox" checked={taskGroupByVisitor} onChange={e => setTaskGroupByVisitor(e.target.checked)} />
                Regrouper par visiteur
              </label>
            </div>
          </div>

          {taskFolders.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gy)', textAlign: 'center', padding: '30px 0' }}>Aucune tâche en attente.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {taskFolders.map(folder => {
                const isOpen = openFolders[folder.key] ?? (folder.key === 'urgentes')
                const grouped = {}
                if (taskGroupByVisitor) {
                  folder.items.forEach(t => {
                    const name = `${t.contact?.first_name || ''} ${t.contact?.last_name || ''}`.trim() || 'Sans visiteur'
                    ;(grouped[name] = grouped[name] || []).push(t)
                  })
                }
                return (
                  <div key={folder.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div onClick={() => setOpenFolders(prev => ({ ...prev, [folder.key]: !isOpen }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: '#F8FAFC' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{isOpen ? '▾' : '▸'} {folder.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', background: '#EFF6FF', padding: '2px 10px', borderRadius: 999 }}>{folder.items.length}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {taskGroupByVisitor ? (
                          Object.entries(grouped).map(([name, items]) => (
                            <div key={name}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gd)', marginBottom: 6 }}>{name}</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                                {items.map(t => <TaskRow key={t.id} t={t} onOpen={setSelectedTaskId} onToggle={toggleLegacyTask} showAssignee={viewAs !== 'me'} />)}
                              </div>
                            </div>
                          ))
                        ) : (
                          folder.items.map(t => <TaskRow key={t.id} t={t} onOpen={setSelectedTaskId} onToggle={toggleLegacyTask} showAssignee={viewAs !== 'me'} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'parcours' && canViewParcours && (
        <ParcoursEnCoursTab parcoursList={parcoursList} />
      )}

      {reportPanelId && (
        <NewcomerReportPanel
          contactId={reportPanelId}
          onClose={() => { setReportPanelId(null); router.refresh() }}
          onOpenFullProfile={(id) => { setReportPanelId(null); router.push(`/visiteurs/${id}`) }}
          currentProfile={profile}
        />
      )}
      {drilldownCategory && (
        <NeedsDrilldownModal
          categoryId={drilldownCategory}
          onClose={() => { setDrilldownCategory(null); router.refresh() }}
          profiles={profiles}
        />
      )}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => { setSelectedTaskId(null); router.refresh() }}
          profiles={profiles}
        />
      )}
      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          fis={fis}
          communes={communes}
          suiviTeam={suiviTeam}
          canViewTeam={canViewTeam}
        />
      )}
    </div>
  )
}

function TaskRow({ t, onOpen, onToggle, showAssignee }) {
  // Etat recalcule dynamiquement depuis due_date + status (section 11) —
  // ne se fie plus jamais a t.priority, qui n'est pose qu'une seule
  // fois a la creation et n'est jamais remis a jour ensuite.
  const state = getTaskState(t)
  const color = state === 'a_relancer' ? '#F97316' : state === 'termine' ? '#94A3B8' : '#22C55E'
  const stateLabel = TASK_STATE_LABEL[state]
  return (
    <div onClick={() => onOpen(t.id)} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div onClick={e => onToggle(e, t.id)} style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${color}`, cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{t.title || t.type}</span> — {t.contact?.first_name} {t.contact?.last_name} · Échéance : {t.due_date}
        {showAssignee && t.assignee?.name && <span style={{ color: 'var(--gy)' }}> · {t.assignee.name}</span>}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '1A', padding: '3px 8px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>
        {stateLabel.emoji} {stateLabel.label}
      </span>
    </div>
  )
}
