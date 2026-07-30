'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { STAGE_ICON_MAP } from '@/lib/icons'
import { AlertTriangle, AlertCircle, X, ChevronDown, ChevronUp, LayoutDashboard, Users as UsersIcon } from '@/lib/icons'

const ini = (fn, ln) => ((fn || '')[0] || '') + ((ln || '')[0] || '')

const GROUP_OPTIONS = [
  ['none', 'Aucun'], ['stage', 'Étape'], ['commune', 'Commune'], ['agent', 'Agent'],
]
const SORT_FIELDS = [
  ['name', 'Nom'], ['sexe', 'Sexe'], ['commune', 'Commune'], ['stage', 'Étape'], ['score', 'Score'], ['agent', 'Agent'],
]

function AlertDot({ level }) {
  const color = level === 'red' ? '#EF4444' : level === 'orange' ? '#F97316' : '#22C55E'
  return <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:color }} />
}

export default function PipelineClient({ contacts, fis = [], communes = [] }) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'liste'
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)
  const [warning, setWarning] = useState('')

  // ---- Vue Liste : tri + regroupement + edition d'etape en ligne ----
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [groupBy, setGroupBy] = useState('none')
  const [openGroups, setOpenGroups] = useState({})

  useRealtimeRefresh(['contacts', 'familles_impact'])

  async function changeStage(contactId, newStageId) {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact || contact.stage === newStageId) return
    const res = await fetch(`/api/contacts/${contactId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStage: newStageId })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    if (data.warning) setWarning(`${contact.first_name} ${contact.last_name} : ${data.warning}`)
    router.refresh()
  }

  async function dropOn(stageId) {
    setDragOverStage(null)
    if (!draggingId) return
    const id = draggingId
    setDraggingId(null)
    await changeStage(id, stageId)
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sortedContacts = useMemo(() => {
    const arr = [...contacts]
    const valueFor = (c, field) => {
      if (field === 'name') return `${c.last_name || ''} ${c.first_name || ''}`.toLowerCase()
      if (field === 'sexe') return c.sex || ''
      if (field === 'commune') return c.commune || ''
      if (field === 'stage') return STAGE_LABEL(c.stage)
      if (field === 'score') return c.integration_score || 0
      if (field === 'agent') return c.agent?.name || ''
      return ''
    }
    arr.sort((a, b) => {
      const va = valueFor(a, sortField), vb = valueFor(b, sortField)
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [contacts, sortField, sortDir])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: null, label: null, items: sortedContacts }]
    const map = {}
    sortedContacts.forEach(c => {
      let key
      if (groupBy === 'stage') key = STAGE_LABEL(c.stage)
      else if (groupBy === 'commune') key = c.commune || 'Non renseignée'
      else if (groupBy === 'agent') key = c.agent?.name || 'Non assigné'
      ;(map[key] = map[key] || []).push(c)
    })
    return Object.entries(map).map(([label, items]) => ({ key: label, label, items }))
  }, [sortedContacts, groupBy])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize: 13, color: 'var(--gy)' }}>{contacts.length} personnes en parcours d'intégration</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setViewMode('kanban')} style={{ ...viewBtnStyle, ...(viewMode==='kanban' ? viewBtnActiveStyle : {}) }}>
            <LayoutDashboard size={13} strokeWidth={2} /> Kanban
          </button>
          <button onClick={() => setViewMode('liste')} style={{ ...viewBtnStyle, ...(viewMode==='liste' ? viewBtnActiveStyle : {}) }}>
            <UsersIcon size={13} strokeWidth={2} /> Liste
          </button>
        </div>
      </div>

      {warning && (
        <div style={{ background: '#FFF7ED', color: '#9A3412', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={15} strokeWidth={2} /> {warning} (déplacé quand même)
          </span>
          <button onClick={() => setWarning('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A3412', display:'flex' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <div className="kw">
          {STAGES.map(stage => {
            const sv = contacts.filter(c => c.stage === stage.id)
            const isOver = dragOverStage === stage.id
            const StageIcon = STAGE_ICON_MAP[stage.id]
            return (
              <div
                key={stage.id}
                className="kc"
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                onDragLeave={() => setDragOverStage(prev => (prev === stage.id ? null : prev))}
                onDrop={e => { e.preventDefault(); dropOn(stage.id) }}
                style={{ outline: isOver ? `2px dashed ${stage.color}` : 'none', outlineOffset: 2, borderRadius: 12 }}
              >
                <div className="kh" style={{ background: stage.color + 'E6' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {StageIcon && <StageIcon size={16} strokeWidth={2} color="#fff" />}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: .3, textTransform: 'uppercase', lineHeight: 1.2 }}>{stage.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{sv.length}</div>
                </div>
                {sv.length ? sv.map(c => (
                  <div
                    key={c.id}
                    className="kcard"
                    draggable
                    onDragStart={() => setDraggingId(c.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => router.push(`/visiteurs/${c.id}`)}
                    style={{ borderLeft: `3px solid ${stage.color}`, cursor: 'grab', opacity: draggingId === c.id ? .4 : 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.sex === 'F' ? '#8B5CF6' : 'var(--n)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{ini(c.first_name, c.last_name)}</div>
                      <div><div style={{ fontSize: 11, fontWeight: 700 }}>{c.first_name} {c.last_name}</div><div style={{ fontSize: 10, color: 'var(--gy)' }}>{c.commune || '—'}</div></div>
                    </div>
                    <div className="sbr"><div className="sbr-bar"><div className="sbr-fill" style={{ width: `${c.integration_score}%`, background: scoreColor(c.integration_score) }} /></div><span className="sbr-val" style={{ color: scoreColor(c.integration_score) }}>{c.integration_score}</span></div>
                    {c.alert_level === 'red' && (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--re)', fontWeight: 600, display:'flex', alignItems:'center', gap:4 }}>
                        <AlertCircle size={11} strokeWidth={2} /> Urgence
                      </div>
                    )}
                    {c.agent?.name && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--gd)' }}>{c.agent.name}</div>}
                  </div>
                )) : <div style={{ padding: 16, borderRadius: 10, border: '2px dashed var(--br)', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>Aucune personne</div>}
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', gap:16, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'var(--gy)', fontWeight:600 }}>Grouper par :</span>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={selectStyle}>
                {GROUP_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {groups.map(g => (
            <div key={g.key || 'all'} style={{ marginBottom: 16 }}>
              {g.label && (
                <div onClick={() => setOpenGroups(prev => ({ ...prev, [g.key]: prev[g.key] === false ? true : false }))} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 4px', cursor:'pointer', fontSize:13, fontWeight:700, color:'var(--gd)' }}>
                  {openGroups[g.key] === false ? '▸' : '▾'} {g.label} <span style={{ fontSize:11, color:'var(--gy)', fontWeight:600 }}>({g.items.length})</span>
                </div>
              )}
              {openGroups[g.key] !== false && (
                <div className="card" style={{ padding:0, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          {SORT_FIELDS.map(([field, label]) => (
                            <th key={field} onClick={() => toggleSort(field)} style={{ cursor:'pointer', userSelect:'none' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                                {label}
                                {sortField === field && (sortDir === 'asc' ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />)}
                              </span>
                            </th>
                          ))}
                          <th>Urgence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map(c => (
                          <tr key={c.id}>
                            <td onClick={() => router.push(`/visiteurs/${c.id}`)} style={{ cursor:'pointer', fontSize:13, fontWeight:600 }}>{c.first_name} {c.last_name}</td>
                            <td style={{ fontSize:12 }}>{c.sex}</td>
                            <td style={{ fontSize:12 }}>{c.commune || '—'}</td>
                            <td>
                              <select value={c.stage} onChange={e => changeStage(c.id, e.target.value)} style={selectStyle} onClick={e => e.stopPropagation()}>
                                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <div className="sbr"><div className="sbr-bar"><div className="sbr-fill" style={{ width:`${c.integration_score}%`, background:scoreColor(c.integration_score) }} /></div><span className="sbr-val" style={{ color:scoreColor(c.integration_score) }}>{c.integration_score}</span></div>
                            </td>
                            <td style={{ fontSize:12, color:'var(--gd)' }}>{c.agent?.name || <span style={{ color:'var(--gy)', fontStyle:'italic' }}>Non assigné</span>}</td>
                            <td><AlertDot level={c.alert_level} /></td>
                          </tr>
                        ))}
                        {g.items.length === 0 && (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--gy)' }}>Aucune personne</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const viewBtnStyle = {
  display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
  border:'1px solid var(--br)', background:'#fff', color:'var(--gd)', fontSize:12, fontWeight:600, cursor:'pointer'
}
const viewBtnActiveStyle = { background:'var(--n)', color:'#fff', border:'1px solid var(--n)' }
const selectStyle = {
  padding:'5px 8px', borderRadius:6, border:'1px solid var(--br)', fontSize:12, fontFamily:'inherit', background:'#fff'
}
