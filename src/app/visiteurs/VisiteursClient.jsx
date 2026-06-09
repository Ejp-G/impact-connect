'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, STAGES } from '@/lib/constants'
import { formatDate, scoreColor } from '@/lib/utils'

export default function VisiteursClient({ contacts, stats, fis, communes, profile }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firstName:'',lastName:'',sex:'F',phone:'',whatsapp:'',email:'',commune:'',communeId:'',quartier:'',firstVisit:true,salvationCall:false,wantsContact:true,wantsFI:true,dateOfBirth:'',howFound:'',prayerRequest:'',interests:[],parentLastName:'',parentFirstName:'',parentPhone:'',parentEmail:'',parentRelation:'' })
  const router = useRouter()

  const isMinor = form.dateOfBirth && new Date(form.dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear()-18))

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${c.first_name} ${c.last_name} ${c.commune||''}`.toLowerCase().includes(q)
    if (!matchSearch) return false
    if (filter === 'alert') return c.alert_level === 'red'
    if (filter === 'orange') return c.alert_level === 'orange'
    if (filter === 'new') return c.created_at?.startsWith(new Date().toISOString().split('T')[0])
    if (filter === 'minor') return c.is_minor
    if (filter === 'salvation') return c.salvation_call
    return true
  })

  const ini = (fn, ln) => ((fn||'')[0]||'') + ((ln||'')[0]||'')

  async function saveVisitor() {
    setSaving(true)
    const res = await fetch('/api/visitors', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const { data, error } = await res.json()
    if (error) { alert(error); setSaving(false); return }
    setShowModal(false)
    setSaving(false)
    router.refresh()
  }

  const canAdd = ['admin','responsable_integration','equipe_integration'].includes(profile?.role)

  return (
    <div style={{ maxWidth:1200 }}>
      {/* Filtres */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[['all','Tous',stats.total],['alert','🔴 Urgences',stats.alerts],['new','🆕 Aujourd'hui',stats.today],['minor','👶 Mineurs',stats.mineurs]].map(([f,l,c])=>(
            <div key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:filter===f?'var(--n)':'#F1F5F9', color:filter===f?'#fff':'#64748B', display:'flex', alignItems:'center', gap:5 }}>
              {l} <span style={{ background:filter===f?'rgba(255,255,255,.2)':'#E2E8F0', padding:'0 5px', borderRadius:999, fontSize:10 }}>{c}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid var(--br)', borderRadius:10, padding:'8px 14px' }}>
            <span>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" style={{ border:'none', outline:'none', fontFamily:'inherit', fontSize:13, color:'var(--gd)', width:160 }} />
          </div>
          {canAdd && (
            <button onClick={()=>setShowModal(true)} className="btn btn-primary">✚ Nouveau visiteur</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr>
              <th>Personne</th><th>Contact</th><th>Commune / FI</th><th>Étape</th><th style={{minWidth:130}}>Score</th><th>Agent</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:c.sex==='F'?'#8B5CF6':'var(--n)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>
                      {ini(c.first_name, c.last_name)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{c.first_name} {c.last_name}
                        {c.is_minor && <span style={{ fontSize:10, background:'#FEF3C7', color:'#92400E', padding:'1px 5px', borderRadius:4, marginLeft:6 }}>mineur</span>}
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
                    <div style={{ fontSize:11, color:c.fi?'var(--gr)':'var(--gy)' }}>{c.fi?.name||'Non attribué'}</div>
                  </td>
                  <td><span className="badge" style={{ background:STAGE_COLOR(c.stage)+'20', color:STAGE_COLOR(c.stage) }}>{STAGE_LABEL(c.stage)}</span></td>
                  <td>
                    <div className="sbr">
                      <div className="sbr-bar"><div className="sbr-fill" style={{ width:`${c.integration_score}%`, background:scoreColor(c.integration_score) }} /></div>
                      <span className="sbr-val" style={{ color:scoreColor(c.integration_score) }}>{c.integration_score}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:'var(--gd)' }}>{c.agent?.name||<span style={{color:'var(--gy)',fontStyle:'italic'}}>Non assigné</span>}</td>
                  <td>{c.alert_level==='red'?'🔴':c.alert_level==='orange'?'🟠':'✅'}</td>
                  <td><div style={{ display:'flex', gap:4 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13 }}>👁</div>
                    {canAdd && <div style={{ width:28, height:28, borderRadius:8, background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13 }}>✏️</div>}
                  </div></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--gy)' }}>Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #F1F5F9', fontSize:12, color:'var(--gy)' }}>
          {filtered.length} personne(s) affichée(s)
        </div>
      </div>

      {/* Modal Ajout */}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>Nouveau visiteur</div>
              <button onClick={()=>setShowModal(false)} style={{ width:32, height:32, borderRadius:8, background:'#F1F5F9', border:'none', cursor:'pointer', fontSize:16, color:'var(--gd)' }}>✕</button>
            </div>
            <div className="g2">
              <div className="form-group"><label className="form-label">Prénom *</label><input className="form-input" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} /></div>
            </div>
            <div className="form-group"><label className="form-label">Date de naissance</label><input type="date" className="form-input" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})} /></div>
            {isMinor && (
              <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--or)', marginBottom:12 }}>👶 Mineur — Informations du responsable légal</div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Nom du parent *</label><input className="form-input" value={form.parentLastName} onChange={e=>setForm({...form,parentLastName:e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Prénom du parent *</label><input className="form-input" value={form.parentFirstName} onChange={e=>setForm({...form,parentFirstName:e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Téléphone parent *</label><input className="form-input" value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Lien de parenté</label>
                  <select className="form-input" value={form.parentRelation} onChange={e=>setForm({...form,parentRelation:e.target.value})}>
                    <option value="">Sélectionner…</option>
                    {['Père','Mère','Tuteur','Tutrice','Grand-père','Grand-mère'].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Sexe</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['F','👩 Femme'],['M','👨 Homme']].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm({...form,sex:v})} style={{ flex:1, padding:10, borderRadius:10, border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`, background:form.sex===v?'rgba(11,61,145,.08)':'#fff', textAlign:'center', fontSize:13, fontWeight:600, color:form.sex===v?'var(--n)':'#64748B', cursor:'pointer' }}>{l}</div>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Téléphone</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Commune</label>
              <select className="form-input" value={form.communeId} onChange={e=>{const opt=e.target.options[e.target.selectedIndex];setForm({...form,communeId:e.target.value,commune:opt.text})}}>
                <option value="">Sélectionner…</option>
                {communes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:16, marginBottom:16 }}>
              {[['firstVisit','Première visite'],['salvationCall','Appel au salut'],['wantsContact','Souhaite être contacté'],['wantsFI','Souhaite rejoindre une FI']].map(([k,l])=>(
                <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})} style={{ width:16, height:16 }} />{l}
                </label>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              <button onClick={()=>setShowModal(false)} className="btn btn-secondary" style={{ flex:1 }}>Annuler</button>
              <button onClick={saveVisitor} disabled={saving} className="btn btn-primary" style={{ flex:2 }}>
                {saving ? '⏳ Enregistrement…' : '✚ Enregistrer + Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
