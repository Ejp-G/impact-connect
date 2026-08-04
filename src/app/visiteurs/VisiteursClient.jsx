'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, STAGES } from '@/lib/constants'
import { formatDate, scoreColor } from '@/lib/utils'
import ImportModal from '@/components/contacts/ImportModal'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { Search, Upload, Filter, X } from '@/lib/icons'

function AlertDot({ level }) {
  const color = level === 'red' ? '#EF4444' : level === 'orange' ? '#F97316' : '#22C55E'
  return <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:color }} />
}

const normName = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const normPhone = p => (p || '').replace(/\D/g, '')

export default function VisiteursClient({ contacts, stats, fis, communes, profile, duplicates = [] }) {
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [form, setForm] = useState({
    firstName:'',lastName:'',sex:'F',phone:'',whatsapp:'',email:'',
    commune:'',communeId:'',quartier:'',firstVisit:true,salvationCall:false,
    wantsContact:true,wantsFI:true,dateOfBirth:'',howFound:'',prayerRequest:'',
    interests:[],parentLastName:'',parentFirstName:'',parentPhone:'',parentEmail:'',parentRelation:''
  })
  const router = useRouter()

  useRealtimeRefresh(['contacts', 'familles_impact'])

  const isMinor = form.dateOfBirth && new Date(form.dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear()-18))

  // Ensemble des fiches appartenant à un groupe de doublons (marquage des lignes)
  const duplicateIds = new Set(duplicates.flatMap(g => g.contacts.map(c => c.id)))

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const haystack = (c.first_name+' '+c.last_name+' '+(c.commune||'')+' '+(c.phone||'')+' '+normPhone(c.phone)).toLowerCase()
    const matchSearch = !q || haystack.includes(q)
    if (!matchSearch) return false
    if (filter === 'alert') return c.alert_level === 'red'
    if (filter === 'orange') return c.alert_level === 'orange'
    if (filter === 'new') return c.created_at?.startsWith(new Date().toISOString().split('T')[0])
    if (filter === 'minor') return c.is_minor
    if (filter === 'men') return c.sex === 'M'
    if (filter === 'women') return c.sex === 'F'
    if (filter === 'no_integrator') return !(c.integrators?.length)
    if (filter === 'duplicates') return duplicateIds.has(c.id)
    if (filter === 'salvation') return c.salvation_call === true
    if (filter === 'no_contact') return c.contact_preference === 'none'
    if (filter === 'mine') return c.agent?.id === profile?.id
    return true
  })

  const ini = (fn, ln) => ((fn||'')[0]||'') + ((ln||'')[0]||'')

  async function saveVisitor() {
    // Garde-fou anti-doublon : vérifier si une fiche existe déjà avec
    // le même nom complet ou le même numéro de téléphone
    const newName = normName(`${form.firstName} ${form.lastName}`)
    const newPhone = normPhone(form.phone)
    const existing = contacts.find(c =>
      (newName && normName(`${c.first_name} ${c.last_name}`) === newName) ||
      (newPhone.length >= 6 && normPhone(c.phone) === newPhone)
    )
    if (existing) {
      const ok = window.confirm(
        `⚠ Une fiche existe déjà pour ${existing.first_name} ${existing.last_name}` +
        `${existing.phone ? ` (${existing.phone})` : ''}, arrivé(e) le ${formatDate(existing.first_visit_date) || '—'}.\n\n` +
        `Créer quand même une NOUVELLE fiche ?\n(Annuler pour éviter un doublon)`
      )
      if (!ok) return
    }

    setSaving(true)
    const res = await fetch('/api/visitors', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const { data, error } = await res.json()
    if (error) { alert(error); setSaving(false); return }
    setShowModal(false); setSaving(false); router.refresh()
  }

  const canAdd = ['admin','responsable_suivi','equipe_suivi'].includes(profile?.role)

  const filterBtns = [
    ['all', 'Tous', stats.total],
    ['alert', 'Urgences', stats.alerts],
    ['new', "Aujourd'hui", stats.today],
    ['minor', 'Mineurs', stats.mineurs],
    ['men', 'Hommes', stats.hommes],
    ['women', 'Femmes', stats.femmes],
    ['no_integrator', 'Sans intégrateur', stats.sansIntegrateur],
    ...(stats.doublons > 0 ? [['duplicates', 'Doublons', stats.doublons]] : []),
    ['no_contact', 'Ne pas contacter', contacts.filter(c => c.contact_preference === 'none').length],
  ]

  return (
    <div style={{ maxWidth:1200 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div className="filter-chips-desktop" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {filterBtns.map(([f,l,c])=>(
            <div key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:filter===f?'var(--n)':f==='duplicates'?'#FFF7ED':'#F1F5F9', color:filter===f?'#fff':f==='duplicates'?'#9A3412':'#64748B', display:'flex', alignItems:'center', gap:5 }}>
              {l} <span style={{ background:filter===f?'rgba(255,255,255,.2)':'#E2E8F0', padding:'0 5px', borderRadius:999, fontSize:10 }}>{c}</span>
            </div>
          ))}
        </div>
        <div className="filter-btn-mobile" style={{ position:'relative' }}>
          <button onClick={() => setShowFilterMenu(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--br)', background: filter!=='all' ? 'rgba(11,61,145,.08)' : '#fff', color: filter!=='all' ? 'var(--n)' : 'var(--gd)', fontWeight:600, fontSize:13 }}>
            <Filter size={14} strokeWidth={2} /> Filtres
            {filter!=='all' && <span style={{ background:'var(--n)', color:'#fff', borderRadius:999, fontSize:10, padding:'1px 6px' }}>1</span>}
          </button>
          {showFilterMenu && (
            <div onClick={() => setShowFilterMenu(false)} style={{ position:'fixed', inset:0, zIndex:998 }}>
              <div onClick={e => e.stopPropagation()} style={{ position:'absolute', top:44, left:0, right:0, background:'#fff', borderRadius:14, boxShadow:'0 12px 32px rgba(0,0,0,.18)', padding:10, zIndex:999, display:'flex', flexDirection:'column', gap:4, maxHeight:'60vh', overflowY:'auto' }}>
                {filterBtns.map(([f,l,c])=>(
                  <div key={f} onClick={() => { setFilter(f); setShowFilterMenu(false) }} style={{ padding:'10px 12px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, background:filter===f?'var(--n)':'transparent', color:filter===f?'#fff':'#374151', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    {l} <span style={{ background:filter===f?'rgba(255,255,255,.2)':'#F1F5F9', padding:'1px 8px', borderRadius:999, fontSize:11 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--br)', borderRadius:10, padding:'8px 14px' }}>
            <Search size={15} strokeWidth={2} color="#94A3B8" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{ border:'none', outline:'none', fontFamily:'inherit', fontSize:13, color:'var(--gd)', width:160 }} />
          </div>
          {canAdd && (
            <>
              <button onClick={() => setShowImport(true)} className="btn" style={{ background: '#16A34A', color: '#fff', border: 'none', display:'flex', alignItems:'center', gap:6 }}>
                <Upload size={14} strokeWidth={2} /> Importer
              </button>
              <button onClick={()=>setShowModal(true)} className="btn btn-primary">+ Nouveau visiteur</button>
            </>
          )}
        </div>
      </div>

      {/* ─── Alerte doublons potentiels ─── */}
      {duplicates.length > 0 && (
        <div className="card" style={{ border:'1px solid #FED7AA', background:'#FFF7ED', marginBottom:16 }}>
          <div
            onClick={()=>setShowDuplicates(v=>!v)}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
          >
            <div style={{ fontSize:13, fontWeight:700, color:'#9A3412' }}>
              ⚠ {duplicates.length} doublon(s) potentiel(s) détecté(s) ({stats.doublons} fiches concernées)
            </div>
            <span style={{ fontSize:12, color:'#9A3412', fontWeight:600 }}>{showDuplicates ? 'Masquer ▲' : 'Voir le détail ▼'}</span>
          </div>
          {showDuplicates && (
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
              {duplicates.map((g, i) => (
                <div key={i} style={{ background:'#fff', borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9A3412', textTransform:'uppercase', marginBottom:8 }}>
                    Groupe {i+1} — {g.reasons.join(' + ')}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {g.contacts.map(c => (
                      <div
                        key={c.id}
                        onClick={()=>router.push(`/visiteurs/${c.id}`)}
                        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, fontSize:12, cursor:'pointer', padding:'6px 8px', borderRadius:8, background:'#F8FAFC', flexWrap:'wrap' }}
                      >
                        <span style={{ fontWeight:700, color:'var(--n)' }}>{c.name}</span>
                        <span style={{ color:'#64748B' }}>{c.phone || 'sans tél.'}</span>
                        <span className="badge" style={{ background:STAGE_COLOR(c.stage)+'20', color:STAGE_COLOR(c.stage) }}>{STAGE_LABEL(c.stage)}</span>
                        <span style={{ color:'#64748B' }}>score {c.score ?? 0}</span>
                        <span style={{ color:'#94A3B8' }}>créée le {formatDate(c.created_at)}</span>
                        <span style={{ color:'var(--n)', fontWeight:600 }}>Ouvrir →</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ fontSize:12, color:'#9A3412', lineHeight:1.5 }}>
                Comment traiter un doublon : ouvrez les deux fiches, complétez celle à conserver
                (la plus avancée / la plus complète), puis un administrateur supprime l'autre via
                la « Zone dangereuse » en bas de sa fiche (suppression tracée dans le journal).
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr>
              <th>Personne</th><th>Contact</th><th>Commune / FI</th><th>Etape</th><th style={{minWidth:130}}>Score</th><th>Agent</th><th>Statut</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => router.push(`/visiteurs/${c.id}`)} style={{ cursor: 'pointer', background: duplicateIds.has(c.id) ? '#FFFBF5' : undefined }}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:c.sex==='F'?'#8B5CF6':'var(--n)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>
                      {ini(c.first_name, c.last_name)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{c.first_name} {c.last_name}
                        {c.is_minor && <span style={{ fontSize:10, background:'#FEF3C7', color:'#92400E', padding:'1px 5px', borderRadius:4, marginLeft:6 }}>mineur</span>}
                        {duplicateIds.has(c.id) && <span style={{ fontSize:10, background:'#FFF7ED', color:'#9A3412', padding:'1px 5px', borderRadius:4, marginLeft:6, fontWeight:700 }}>doublon ?</span>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--gy)' }}>{formatDate(c.first_visit_date)}</div>
                    </div>
                  </div></td>
                  <td>
                    <div style={{ fontSize:12, color:'var(--gd)' }}>{c.phone||'—'}</div>
                    <div style={{ fontSize:11, color:'var(--gy)' }}>{c.email||'—'}</div>
                  </td>
                  <td>
                    <div style={{ fontSize:12, fontWeight:500 }}>{c.commune||'—'}</div>
                    <div style={{ fontSize:11, color:c.fi?'var(--gr)':'var(--gy)' }}>{c.fi?.name||'Non attribue'}</div>
                  </td>
                  <td><span className="badge" style={{ background:STAGE_COLOR(c.stage)+'20', color:STAGE_COLOR(c.stage) }}>{STAGE_LABEL(c.stage)}</span></td>
                  <td>
                    <div className="sbr">
                      <div className="sbr-bar"><div className="sbr-fill" style={{ width:`${c.integration_score}%`, background:scoreColor(c.integration_score) }} /></div>
                      <span className="sbr-val" style={{ color:scoreColor(c.integration_score) }}>{c.integration_score}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:'var(--gd)' }}>{c.agent?.name||<span style={{color:'var(--gy)',fontStyle:'italic'}}>Non assigne</span>}</td>
                  <td><AlertDot level={c.alert_level} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--gy)' }}>Aucun resultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #F1F5F9', fontSize:12, color:'var(--gy)' }}>
          {filtered.length} personne(s) affichee(s)
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>Nouveau visiteur</div>
              <button onClick={()=>setShowModal(false)} style={{ width:32, height:32, borderRadius:8, background:'#F1F5F9', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gd)' }}><X size={16} strokeWidth={2} /></button>
            </div>
            <div className="g2">
              <div className="form-group"><label className="form-label">Prenom *</label><input className="form-input" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} /></div>
            </div>
            <div className="form-group"><label className="form-label">Date de naissance</label><input type="date" className="form-input" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})} /></div>
            {isMinor && (
              <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--or)', marginBottom:12 }}>Mineur — Informations du responsable legal</div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Nom du parent *</label><input className="form-input" value={form.parentLastName} onChange={e=>setForm({...form,parentLastName:e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Prenom du parent *</label><input className="form-input" value={form.parentFirstName} onChange={e=>setForm({...form,parentFirstName:e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Telephone parent *</label><input className="form-input" value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})} /></div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Sexe</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['F','Femme'],['M','Homme']].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm({...form,sex:v})} style={{ flex:1, padding:10, borderRadius:10, border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`, background:form.sex===v?'rgba(11,61,145,.08)':'#fff', textAlign:'center', fontSize:13, fontWeight:600, color:form.sex===v?'var(--n)':'#64748B', cursor:'pointer' }}>{l}</div>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Commune</label>
              <select className="form-input" value={form.communeId} onChange={e=>{const opt=e.target.options[e.target.selectedIndex];setForm({...form,communeId:e.target.value,commune:opt.text})}}>
                <option value="">Selectionner...</option>
                {communes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap' }}>
              {[['firstVisit','Premiere visite'],['salvationCall','Appel au salut'],['wantsContact','Souhaite etre contacte'],['wantsFI','Souhaite rejoindre une FI']].map(([k,l])=>(
                <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})} style={{ width:16, height:16 }} />{l}
                </label>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              <button onClick={()=>setShowModal(false)} className="btn btn-secondary" style={{ flex:1 }}>Annuler</button>
              <button onClick={saveVisitor} disabled={saving} className="btn btn-primary" style={{ flex:2 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer + Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  )
}
