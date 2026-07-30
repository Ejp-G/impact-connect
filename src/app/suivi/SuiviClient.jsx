'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PRIORITY_COLORS, STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import NewcomerReportPanel from '@/components/suivi/NewcomerReportPanel'
import NeedsDrilldownModal from '@/components/suivi/NeedsDrilldownModal'
import { Users, CheckSquare, Compass, NEED_ICON_MAP } from '@/lib/icons'

const FILTERS = [
  ['all', 'Tous'], ['today', 'À contacter aujourd\'hui'], ['late', 'En retard'],
  ['new', 'Nouveaux'], ['salvation', 'Prière du salut'], ['reconciliation', 'Réconciliation'],
  ['no_integrator', 'Sans intégrateur'], ['male', 'Homme'], ['female', 'Femme'],
  ['fi_yes', 'FI attribuée'], ['fi_no', 'FI non attribuée'],
]

function AlertDot({ level }) {
  const color = level === 'red' ? '#EF4444' : level === 'orange' ? '#F97316' : '#22C55E'
  return <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:color }} />
}

export default function SuiviClient({ contacts, reports, needs, tasks: initialTasks, profiles = [], profile }) {
  const router = useRouter()
  const [tab, setTab] = useState('nouveaux')
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

    return contacts.filter(c => {
      const q = search.toLowerCase()
      if (q && !`${c.first_name} ${c.last_name} ${c.commune || ''}`.toLowerCase().includes(q)) return false

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

  const needsSummary = useMemo(() => {
    const byCategory = {}
    needs.forEach(n => {
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
  }, [needs])

  async function toggleLegacyTask(e, id) {
    e.stopPropagation()
    const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'done' }) })
    if (res.ok) { setTasks(prev => prev.filter(t => t.id !== id)); router.refresh() }
  }

  // Boite de reception intelligente : regroupe les taches en dossiers
  // (Urgentes en premier, quel que soit le type, puis un dossier par
  // type distinct). Une tache urgente n'apparait que dans "Urgentes"
  // pour eviter un doublon visuel entre deux dossiers.
  const taskFolders = useMemo(() => {
    const q = taskSearch.toLowerCase()
    const filtered = tasks.filter(t => {
      if (!q) return true
      const name = `${t.contact?.first_name || ''} ${t.contact?.last_name || ''}`.toLowerCase()
      return name.includes(q) || (t.title || '').toLowerCase().includes(q) || (t.type || '').toLowerCase().includes(q)
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
    Object.entries(byType).forEach(([type, items]) => folders.push({ key: type, label: type, items }))
    return folders
  }, [tasks, taskSearch])

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['nouveaux', 'Suivi des nouveaux', Users], ['taches', 'Tâches', CheckSquare]].map(([id, label, Icon]) => (
          <div key={id} onClick={() => setTab(id)} style={{
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: tab === id ? 'var(--n)' : '#F1F5F9', color: tab === id ? '#fff' : '#64748B',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Icon size={15} strokeWidth={2} /> {label}
          </div>
        ))}
      </div>

      {tab === 'nouveaux' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--br)', borderRadius: 10, padding: '8px 14px' }}>
              <input value={search} onChange={e => changeSearch(e.target.value)} placeholder="Rechercher..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, width: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(([id, label]) => (
                <div key={id} onClick={() => changeFilter(id)} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === id ? 'var(--n)' : '#F1F5F9', color: filter === id ? '#fff' : '#64748B'
                }}>
                  {label}
                </div>
              ))}
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
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Compass size={16} strokeWidth={2} /> Tableau intelligent des besoins
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📥 Boîte de réception ({tasks.length})</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--br)', borderRadius: 8, padding: '5px 10px' }}>
                <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Rechercher..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12, width: 140 }} />
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
                                {items.map(t => <TaskRow key={t.id} t={t} onOpen={setSelectedTaskId} onToggle={toggleLegacyTask} />)}
                              </div>
                            </div>
                          ))
                        ) : (
                          folder.items.map(t => <TaskRow key={t.id} t={t} onOpen={setSelectedTaskId} onToggle={toggleLegacyTask} />)
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
    </div>
  )
}

function TaskRow({ t, onOpen, onToggle }) {
  return (
    <div onClick={() => onOpen(t.id)} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', borderLeft: `4px solid ${PRIORITY_COLORS[t.priority] || '#94A3B8'}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div onClick={e => onToggle(e, t.id)} style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${PRIORITY_COLORS[t.priority] || '#94A3B8'}`, cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{t.title || t.type}</span> — {t.contact?.first_name} {t.contact?.last_name} · Échéance : {t.due_date}
      </div>
    </div>
  )
}
