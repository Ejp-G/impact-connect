'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES } from '@/lib/constants'
import { Search, ChevronDown, ChevronRight, Pencil, Plus } from '@/lib/icons'

const ROLE_COLORS = { admin:'#EF4444', equipe_accueil:'#06B6D4', responsable_suivi:'#8B5CF6', equipe_suivi:'#3B82F6', pilote_fi:'#22C55E', superviseur:'#0B3D91', responsable_jeunesse:'#F59E0B' }
const ini = (nm) => nm?.split(' ').map(w=>w[0]).slice(0,2).join('') || 'U'

const CATEGORY_GROUPS = [
  { key:'admin',   label:'Administrateurs',              roles:['admin'] },
  { key:'accueil', label:'Équipe Accueil',                roles:['equipe_accueil'] },
  { key:'suivi',   label:'Équipe Suivi & Intégration',    roles:['equipe_suivi','responsable_suivi'] },
  { key:'pilotes', label:'Pilotes FIJ',                   roles:['pilote_fi'] },
  { key:'autres',  label:'Autres',                        roles:['superviseur','responsable_jeunesse'] },
]

export default function UtilisateursClient({ users, fis }) {
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'equipe_suivi', sex:'F', fi_id:'', active:true, also_integrator:false })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [openCategories, setOpenCategories] = useState(() => Object.fromEntries(CATEGORY_GROUPS.map(g => [g.key, true])))
  const router = useRouter()

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [users, search])

  const grouped = useMemo(() => {
    return CATEGORY_GROUPS.map(g => ({
      ...g,
      users: filteredUsers.filter(u => g.roles.includes(u.role)).sort((a,b) => (a.name||'').localeCompare(b.name||''))
    }))
  }, [filteredUsers])

  function toggleCategory(key) {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveUser() {
    setSaving(true)
    const method = editUser ? 'PATCH' : 'POST'
    const body = editUser ? { id: editUser.id, ...form } : form
    const res = await fetch('/api/users', { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const { error } = await res.json()
    if (error) { alert(error); setSaving(false); return }
    setShowModal(false); setSaving(false); router.refresh()
  }
  async function toggleActive(id, active) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, active:!active}) })
    router.refresh()
  }
  function openEdit(user) {
    setEditUser(user)
    setForm({ name:user.name, email:user.email, password:'', role:user.role, sex:user.sex||'F', fi_id:user.fi_id||'', active:user.active, also_integrator:user.also_integrator||false })
    setShowModal(true)
  }
  function openAdd() {
    setEditUser(null)
    setForm({ name:'', email:'', password:'', role:'equipe_suivi', sex:'F', fi_id:'', active:true, also_integrator:false })
    setShowModal(true)
  }
  const btnLabel = saving ? 'Enregistrement...' : editUser ? 'Mettre a jour' : 'Creer le compte'

  return (
    <div style={{maxWidth:1000}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid var(--br)',borderRadius:10,padding:'8px 14px'}}>
          <Search size={15} strokeWidth={2} color="#94A3B8" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un nom ou un email..." style={{border:'none',outline:'none',fontFamily:'inherit',fontSize:13,width:220}} />
        </div>
        <button onClick={openAdd} className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}}>
          <Plus size={14} strokeWidth={2} /> Nouvel utilisateur
        </button>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {grouped.map(g => (
          <div key={g.key} className="card" style={{padding:0,overflow:'hidden'}}>
            <div onClick={()=>toggleCategory(g.key)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer',background:'#F8FAFC'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {openCategories[g.key] ? <ChevronDown size={15} strokeWidth={2} /> : <ChevronRight size={15} strokeWidth={2} />}
                <span style={{fontSize:14,fontWeight:700}}>{g.label}</span>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:'var(--gy)',background:'#EFF6FF',padding:'2px 10px',borderRadius:999}}>{g.users.length}</span>
            </div>
            {openCategories[g.key] && (
              g.users.length === 0 ? (
                <div style={{padding:'16px 18px',fontSize:13,color:'var(--gy)'}}>Aucun utilisateur dans cette catégorie.</div>
              ) : (
                <table>
                  <thead><tr><th>Utilisateur</th><th>Email</th><th>FI</th><th>Statut</th><th>Actions</th></tr></thead>
                  <tbody>
                    {g.users.map(u=>(
                      <tr key={u.id}>
                        <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:'50%',background:ROLE_COLORS[u.role]||'var(--n)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700}}>{ini(u.name)}</div>
                          <div>
                            <div style={{fontSize:13,fontWeight:600}}>{u.name}</div>
                            <div style={{fontSize:11,color:'var(--gy)'}}>{u.sex==='F'?'Femme':'Homme'}
                              {u.also_integrator && !['equipe_suivi','responsable_suivi'].includes(u.role) && (
                                <span style={{marginLeft:6,color:'#3B82F6',fontWeight:600}}>+ Suivi & Intégration</span>
                              )}
                            </div>
                          </div>
                        </div></td>
                        <td style={{fontSize:12,color:'var(--gd)'}}>{u.email}</td>
                        <td style={{fontSize:12,color:u.fi?'var(--gr)':'var(--gy)'}}>{u.fi?.name||'—'}</td>
                        <td>
                          <div className={`tog ${u.active?'on':'off'}`} onClick={()=>toggleActive(u.id,u.active)} style={{cursor:'pointer'}}>
                            <div className="tog-th" />
                          </div>
                        </td>
                        <td>
                          <div onClick={()=>openEdit(u)} style={{width:28,height:28,borderRadius:8,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                            <Pencil size={13} strokeWidth={2} color="#3B82F6" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div style={{fontSize:18,fontWeight:700}}>{editUser?'Modifier utilisateur':'Nouvel utilisateur'}</div>
              <button onClick={()=>setShowModal(false)} style={{width:32,height:32,borderRadius:8,background:'#F1F5F9',border:'none',cursor:'pointer',fontSize:16}}>x</button>
            </div>
            <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} disabled={!!editUser} /></div>
            <div className="form-group">
              <label className="form-label">{editUser ? 'Nouveau mot de passe (vide = inchange)' : 'Mot de passe *'}</label>
              <input type="password" className="form-input" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
            </div>
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                {Object.entries(ROLES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Sexe</label>
              <div style={{display:'flex',gap:8}}>
                {[['F','Femme'],['M','Homme']].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm({...form,sex:v})} style={{flex:1,padding:10,borderRadius:10,border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`,background:form.sex===v?'rgba(11,61,145,.08)':'#fff',textAlign:'center',fontSize:13,fontWeight:600,color:form.sex===v?'var(--n)':'#64748B',cursor:'pointer'}}>{l}</div>
                ))}
              </div>
            </div>
            {form.role !== 'equipe_suivi' && form.role !== 'responsable_suivi' && (
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <input type="checkbox" checked={form.also_integrator} onChange={e=>setForm({...form,also_integrator:e.target.checked})} style={{width:16,height:16}} />
                  Fait aussi partie de l&apos;équipe Suivi &amp; Intégration
                </label>
                <div style={{fontSize:11,color:'var(--gy)',marginTop:4}}>
                  Rend cette personne éligible au binôme d&apos;intégrateurs, en plus de son rôle principal.
                </div>
              </div>
            )}
            {form.role === 'pilote_fi' && (
              <div className="form-group"><label className="form-label">Famille Impact assignee</label>
                <select className="form-input" value={form.fi_id} onChange={e=>setForm({...form,fi_id:e.target.value})}>
                  <option value="">Selectionner...</option>
                  {fis.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div style={{display:'flex',gap:12,marginTop:8}}>
              <button onClick={()=>setShowModal(false)} className="btn btn-secondary" style={{flex:1}}>Annuler</button>
              <button onClick={saveUser} disabled={saving} className="btn btn-primary" style={{flex:2}}>{btnLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
