'use client'
import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { STAGE_ICON_MAP } from '@/lib/icons'
import { Search, Filter, X, LayoutDashboard, Users as UsersIcon, ArrowRight, Droplet, Sparkles } from '@/lib/icons'

const ini = (fn, ln) => ((fn || '')[0] || '') + ((ln || '')[0] || '')

const FUNNEL_STAGES = ['visiteur', 'contacte', 'invite_fi', 'fi1', 'fi2', 'integre', 'parcours']

const ADVANCED_FILTERS = [
  ['nouveaux_semaine', 'Nouveaux cette semaine'],
  ['non_contactes', 'Non contactés'],
  ['sans_fi', 'Sans FI'],
  ['sans_pilote', 'Sans pilote'],
  ['discipolat', 'Discipolat commencé'],
  ['baptises', 'Baptisés'],
  ['en_service', 'En service'],
  ['a_relancer', 'À relancer'],
  ['visites_30j', 'Visites des 30 derniers jours'],
  // NOUVEAU : seul filtre qui RÉVÈLE les contacts hors territoire —
  // par défaut ils sont exclus du pipeline actif (funnel, compteurs,
  // liste), sans jamais être supprimés ni perdus.
  ['hors_territoire', '📍 Hors territoire'],
]

function timeAgo(dateStr) {
  if (!dateStr) return 'jamais'
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (h < 24) return `il y a ${Math.max(1, Math.floor(h))}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d}j`
  return `il y a ${Math.floor(d / 7)} sem.`
}

function CompactCard({ c, onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'#F8FAFC', cursor:'pointer', border: c.alert_level === 'red' ? '1px solid #FCA5A5' : '1px solid transparent' }}>
      <div style={{ width:30, height:30, borderRadius:'50%', background: c.sex==='F'?'#8B5CF6':'var(--n)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>{ini(c.first_name,c.last_name)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
          {c.first_name} {c.last_name}
          {c.hors_territoire && <span style={{ fontSize:9, background:'#FFF7ED', color:'#9A3412', padding:'1px 5px', borderRadius:4, fontWeight:700, flexShrink:0 }}>📍</span>}
        </div>
        <div style={{ fontSize:11, color:'var(--gy)' }}>{c.commune || '—'} · {timeAgo(c.last_contact_at || c.first_visit_date)}</div>
      </div>
      {c.alert_level === 'red' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#EF4444', flexShrink:0 }} />}
    </div>
  )
}

export default function PipelineClient({ contacts, fis = [], communes = [], stageEvolution = {} }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState('pipeline')
  const [drawerStage, setDrawerStage] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [search, setSearch] = useState('')
  const [secteur, setSecteur] = useState('')
  const [fiFilter, setFiFilter] = useState('')
  const [piloteFilter, setPiloteFilter] = useState('')
  const [etapeFilter, setEtapeFilter] = useState(searchParams.get('etape') || '')
  const [advanced, setAdvanced] = useState({})
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  useRealtimeRefresh(['contacts', 'familles_impact'])

  const pilotes = useMemo(() => {
    const set = new Set()
    contacts.forEach(c => { if (c.fi?.pilot?.name) set.add(c.fi.pilot.name) })
    return [...set].sort()
  }, [contacts])

  function toggleAdvanced(key) {
    setAdvanced(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase()
    const now = new Date()
    const d7 = new Date(now - 7 * 86400000).toISOString().slice(0, 10)
    const d30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10)
    return contacts.filter(c => {
      // Par défaut, le pipeline actif exclut les contacts hors
      // territoire — sauf si ce filtre précis est explicitement
      // activé, auquel cas seuls eux sont montrés.
      if (advanced.hors_territoire) {
        if (!c.hors_territoire) return false
      } else if (c.hors_territoire) {
        return false
      }

      if (q && !`${c.first_name} ${c.last_name} ${c.phone||''}`.toLowerCase().includes(q)) return false
      if (secteur && c.commune !== secteur) return false
      if (fiFilter && c.fi?.id !== fiFilter) return false
      if (piloteFilter && c.fi?.pilot?.name !== piloteFilter) return false
      if (etapeFilter && c.stage !== etapeFilter) return false
      if (advanced.nouveaux_semaine && !(c.first_visit_date >= d7)) return false
      if (advanced.non_contactes && c.stage !== 'visiteur') return false
      if (advanced.sans_fi && c.fi) return false
      if (advanced.sans_pilote && c.fi?.pilot) return false
      if (advanced.discipolat && c.stage !== 'parcours') return false
      if (advanced.baptises && !c.baptism_date) return false
      if (advanced.en_service && c.stage !== 'service') return false
      if (advanced.a_relancer && c.alert_level !== 'red') return false
      if (advanced.visites_30j && !(c.first_visit_date >= d30)) return false
      return true
    })
  }, [contacts, search, secteur, fiFilter, piloteFilter, etapeFilter, advanced])

  const funnelCounts = useMemo(() => {
    const counts = {}
    FUNNEL_STAGES.forEach(s => { counts[s] = filteredContacts.filter(c => c.stage === s).length })
    return counts
  }, [filteredContacts])

  const totalFunnel = filteredContacts.filter(c => FUNNEL_STAGES.includes(c.stage)).length
  const baptisesCount = filteredContacts.filter(c => c.baptism_date).length
  const enServiceCount = filteredContacts.filter(c => c.stage === 'service').length
  const horsTerritoireCount = useMemo(() => contacts.filter(c => c.hors_territoire).length, [contacts])

  const drawerContacts = drawerStage && drawerStage !== '__baptises' && drawerStage !== '__service'
    ? filteredContacts.filter(c => c.stage === drawerStage) : []

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sortedForList = useMemo(() => {
    const arr = [...filteredContacts]
    const valueFor = (c, field) => {
      if (field === 'name') return `${c.last_name||''} ${c.first_name||''}`.toLowerCase()
      if (field === 'phone') return c.phone || ''
      if (field === 'commune') return c.commune || ''
      if (field === 'fi') return c.fi?.name || ''
      if (field === 'pilote') return c.fi?.pilot?.name || ''
      if (field === 'stage') return STAGE_LABEL(c.stage)
      if (field === 'lastContact') return c.last_contact_at || ''
      if (field === 'score') return c.integration_score || 0
      return ''
    }
    arr.sort((a,b) => {
      const va = valueFor(a, sortField), vb = valueFor(b, sortField)
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filteredContacts, sortField, sortDir])

  const activeFilterCount = Object.values(advanced).filter(Boolean).length
  const drawerListForDisplay = drawerStage === '__baptises' ? filteredContacts.filter(c=>c.baptism_date)
    : drawerStage === '__service' ? filteredContacts.filter(c=>c.stage==='service')
    : drawerContacts
  const drawerCountForDisplay = drawerStage === '__baptises' ? baptisesCount
    : drawerStage === '__service' ? enServiceCount
    : drawerContacts.length

  return (
    <div>
      <div className="card" style={{ padding:14, marginBottom:20, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F8FAFC', borderRadius:10, padding:'8px 12px', flex:'1 1 180px' }}>
          <Search size={14} strokeWidth={2} color="#94A3B8" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{ border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:13, width:'100%' }} />
        </div>
        <select value={secteur} onChange={e=>setSecteur(e.target.value)} style={selectStyle}>
          <option value="">Secteur</option>
          {communes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={fiFilter} onChange={e=>setFiFilter(e.target.value)} style={selectStyle}>
          <option value="">Famille d'Impact</option>
          {fis.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={piloteFilter} onChange={e=>setPiloteFilter(e.target.value)} style={selectStyle}>
          <option value="">Pilote</option>
          {pilotes.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={etapeFilter} onChange={e=>setEtapeFilter(e.target.value)} style={selectStyle}>
          <option value="">Étape</option>
          {FUNNEL_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL(s)}</option>)}
        </select>
        <button onClick={() => setShowAdvanced(v=>!v)} style={{ ...selectStyle, display:'flex', alignItems:'center', gap:6, cursor:'pointer', background: activeFilterCount ? 'rgba(11,61,145,.08)' : '#fff', color: activeFilterCount ? 'var(--n)' : 'var(--gd)', fontWeight:600 }}>
          <Filter size={13} strokeWidth={2} /> Plus de filtres {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>

        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          <button onClick={() => setViewMode('pipeline')} style={{ ...viewBtnStyle, ...(viewMode==='pipeline' ? viewBtnActiveStyle : {}) }}>
            <LayoutDashboard size={13} strokeWidth={2} /> Pipeline
          </button>
          <button onClick={() => setViewMode('liste')} style={{ ...viewBtnStyle, ...(viewMode==='liste' ? viewBtnActiveStyle : {}) }}>
            <UsersIcon size={13} strokeWidth={2} /> Liste
          </button>
        </div>

        {showAdvanced && (
          <div style={{ width:'100%', display:'flex', gap:8, flexWrap:'wrap', paddingTop:10, borderTop:'1px solid #F1F5F9' }}>
            {ADVANCED_FILTERS.map(([key,label]) => (
              <div key={key} onClick={() => toggleAdvanced(key)} style={{
                padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer',
                background: advanced[key] ? (key === 'hors_territoire' ? '#EA580C' : 'var(--n)') : '#F1F5F9',
                color: advanced[key] ? '#fff' : 'var(--gd)'
              }}>
                {label}{key === 'hors_territoire' && horsTerritoireCount > 0 ? ` (${horsTerritoireCount})` : ''}
              </div>
            ))}
            {activeFilterCount > 0 && (
              <div onClick={() => setAdvanced({})} style={{ padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', color:'#DC2626' }}>
                Réinitialiser
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === 'pipeline' ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 220px', gap:20, alignItems:'start' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--gy)', marginBottom:8 }}>
              Le premier chiffre est le nombre de personnes à cette étape. <b>"% du pipeline"</b> = part de cette étape parmi toutes les personnes en parcours. <b>"vs 30j précédents"</b> = évolution du nombre de personnes arrivées à cette étape par rapport au mois précédent.
              {!advanced.hors_territoire && horsTerritoireCount > 0 && (
                <span> · <b>{horsTerritoireCount}</b> personne(s) hors territoire non comptée(s) ici — voir "Plus de filtres".</span>
              )}
            </div>
            <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8 }}>
              {FUNNEL_STAGES.map((stageId, i) => {
                const Icon = STAGE_ICON_MAP[stageId]
                const count = funnelCounts[stageId]
                const pct = totalFunnel > 0 ? Math.round((count / totalFunnel) * 100) : 0
                return (
                  <div key={stageId} style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                    <div onClick={() => setDrawerStage(stageId)} className="card" style={{ minWidth:150, padding:16, cursor:'pointer', textAlign:'center', transition:'transform .15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ width:36, height:36, borderRadius:10, background:STAGE_COLOR(stageId), display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                        {Icon && <Icon size={17} strokeWidth={2} color="#fff" />}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--gd)', marginBottom:6 }}>{STAGE_LABEL(stageId)}</div>
                      <div style={{ fontSize:26, fontWeight:800, color:'#1E293B' }}>{count}</div>
                      <div style={{ fontSize:10, color:'var(--gy)', marginTop:4 }}>{pct}% du pipeline</div>
                      {stageEvolution[stageId] !== null && stageEvolution[stageId] !== undefined && (
                        <div style={{ fontSize:10, marginTop:2, color: stageEvolution[stageId] >= 0 ? '#16A34A' : '#DC2626', fontWeight:700 }}>
                          {stageEvolution[stageId] >= 0 ? '↑' : '↓'} {Math.abs(stageEvolution[stageId])}% vs 30j précédents
                        </div>
                      )}
                    </div>
                    {i < FUNNEL_STAGES.length - 1 && <ArrowRight size={16} strokeWidth={2} color="#CBD5E1" style={{ flexShrink:0 }} />}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🏆 Fruits de l'intégration</div>
            <div onClick={() => setDrawerStage('__baptises')} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', cursor:'pointer', borderBottom:'1px solid #F1F5F9' }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'#F59E0B', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Droplet size={15} strokeWidth={2} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--gy)' }}>Baptisés</div>
                <div style={{ fontSize:18, fontWeight:800 }}>{baptisesCount}</div>
              </div>
            </div>
            <div onClick={() => setDrawerStage('__service')} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', cursor:'pointer' }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'#F97316', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Sparkles size={15} strokeWidth={2} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--gy)' }}>En service</div>
                <div style={{ fontSize:18, fontWeight:800 }}>{enServiceCount}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  {[['name','Nom'],['phone','Téléphone'],['commune','Secteur'],['fi',"Famille d'Impact"],['pilote','Pilote'],['stage','Étape actuelle'],['lastContact','Dernière visite'],['score','Progression']].map(([f,l]) => (
                    <th key={f} onClick={() => toggleSort(f)} style={{ cursor:'pointer' }}>{l} {sortField===f && (sortDir==='asc'?'↑':'↓')}</th>
                  ))}
                  <th>Dernière action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedForList.map(c => (
                  <tr key={c.id}>
                    <td onClick={() => router.push(`/visiteurs/${c.id}`)} style={{ cursor:'pointer', fontSize:13, fontWeight:600 }}>
                      {c.first_name} {c.last_name}
                      {c.hors_territoire && <span style={{ fontSize:10, background:'#FFF7ED', color:'#9A3412', padding:'1px 5px', borderRadius:4, marginLeft:6, fontWeight:700 }}>📍 hors territoire</span>}
                    </td>
                    <td style={{ fontSize:12 }}>{c.phone || '—'}</td>
                    <td style={{ fontSize:12 }}>{c.commune || '—'}</td>
                    <td style={{ fontSize:12 }}>{c.fi?.name || '—'}</td>
                    <td style={{ fontSize:12 }}>{c.fi?.pilot?.name || '—'}</td>
                    <td><span className="badge" style={{ background:STAGE_COLOR(c.stage)+'20', color:STAGE_COLOR(c.stage) }}>{STAGE_LABEL(c.stage)}</span></td>
                    <td style={{ fontSize:11, color:'var(--gy)' }}>{timeAgo(c.last_contact_at || c.first_visit_date)}</td>
                    <td>
                      <div className="sbr"><div className="sbr-bar"><div className="sbr-fill" style={{ width:`${c.integration_score}%`, background:scoreColor(c.integration_score) }} /></div><span className="sbr-val" style={{ color:scoreColor(c.integration_score) }}>{c.integration_score}</span></div>
                    </td>
                    <td style={{ fontSize:11, color:'var(--gy)' }}>{c.lastAction || '—'}</td>
                    <td><button onClick={() => router.push(`/visiteurs/${c.id}`)} style={smallBtnStyle}>Voir</button></td>
                  </tr>
                ))}
                {sortedForList.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:30, color:'var(--gy)' }}>Aucun résultat</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerStage && (
        <div onClick={() => setDrawerStage(null)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:920, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.25)', animation:'fadeInModal .2s ease' }}>
            <style>{`@keyframes fadeInModal { from { opacity:0; transform:scale(.97); } to { opacity:1; transform:scale(1); } }`}</style>
            <div style={{ padding:'22px 28px', borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:18, fontWeight:800 }}>
                {drawerStage === '__baptises' ? '💧 Baptisés' : drawerStage === '__service' ? '🤝 En service' : STAGE_LABEL(drawerStage)}
                {' '}<span style={{ color:'var(--gy)', fontWeight:600, fontSize:15 }}>({drawerCountForDisplay})</span>
              </div>
              <button onClick={() => setDrawerStage(null)} style={{ background:'#F1F5F9', border:'none', borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:24 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
                {drawerListForDisplay.map(c => (
                  <CompactCard key={c.id} c={c} onClick={() => router.push(`/visiteurs/${c.id}`)} />
                ))}
              </div>
              {drawerCountForDisplay === 0 && (
                <div style={{ textAlign:'center', color:'var(--gy)', fontSize:13, padding:50 }}>Personne dans cette catégorie.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const selectStyle = { padding:'8px 12px', borderRadius:10, border:'1px solid var(--br)', fontSize:12, fontFamily:'inherit', background:'#fff', color:'var(--gd)' }
const viewBtnStyle = { display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--br)', background:'#fff', color:'var(--gd)', fontSize:12, fontWeight:600, cursor:'pointer' }
const viewBtnActiveStyle = { background:'var(--n)', color:'#fff', border:'1px solid var(--n)' }
const smallBtnStyle = { fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--br)', background:'#fff', cursor:'pointer', fontWeight:600 }
