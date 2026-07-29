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

  const [reportPanelId, setReportPanelId] = useState(null)
  const [drilldownCategory, setDrilldownCategory] = useState(null)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [showLegacyTasks, setShowLegacyTasks] = useState(false)

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
    return contacts.filter(c => {
      const q = search.toLowerCase()
      if (q && !`${c.first_name} ${c.last_name} ${c.commune || ''}`.toLowerCase().includes(q)) return false

      const lastReport = latestReportByContact[c.id]
      const contactNeeds = needsByContact[c.id] || []
      const hasIntegrators = (c.integrators || []).length > 0

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
  }, [contacts, filter, search, latestReportByContact, needsByContact, today])

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
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, width: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(([id, label]) => (
                <div key={id} onClick={() => setFilter(id)} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === id ? 'var(--n)' : '#F1F5F9', color: filter === id ? '#fff' : '#64748B'
                }}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  {filteredContacts.map(c => {
                    const lastReport = latestReportByContact[c.id]
                    const integratorNames = (c.integrators || []).map(i => i.integrator?.name).filter(Boolean)
                    return (
                      <tr key={c.id} onClick={() => setReportPanelId(c.id)} style={{ cursor: 'pointer' }}>
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
                  {filteredContacts.length === 0 && (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>Aucun résultat</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', fontSize: 12, color: 'var(--gy)' }}>
              {filteredContacts.length} personne(s) affichée(s)
            </div>
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

          <div onClick={() => setShowLegacyTasks(v => !v)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--gd)', marginBottom: 12 }}>
            {showLegacyTasks ? '▾' : '▸'} Relances système ({tasks.length})
          </div>
          {showLegacyTasks && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(t => (
                <div key={t.id} onClick={() => setSelectedTaskId(t.id)} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', borderLeft: `4px solid ${PRIORITY_COLORS[t.priority] || '#94A3B8'}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div onClick={e => toggleLegacyTask(e, t.id)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${PRIORITY_COLORS[t.priority] || '#94A3B8'}`, cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{t.type}</span> — {t.contact?.first_name} {t.contact?.last_name} · Échéance : {t.due_date}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--gy)' }}>Aucune relance en attente.</div>}
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
