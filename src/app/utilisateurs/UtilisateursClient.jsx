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

// Statuts de service : contrôle l'éligibilité à l'assignation
// automatique de nouveaux visiteurs (auto_assign_integrators) ET à
// l'assignation automatique du planning Accueil & Intégration.
// Une pause déclarée ici se répercute partout — aucun bouton
// "indisponible" séparé n'existe ailleurs dans l'app.
const INTEGRATOR_STATUSES = [
  { value: 'en_service', label: '🟢 En service', color: '#16A34A', bg: '#F0FDF4' },
  { value: 'en_pause',   label: '🟠 En pause',    color: '#C2410C', bg: '#FFF7ED' },
  { value: 'inactif',    label: '⚪ Inactif',      color: '#64748B', bg: '#F8FAFC' },
]
const INTEGRATOR_STATUS_MAP = Object.fromEntries(INTEGRATOR_STATUSES.map(s => [s.value, s]))

// Étendu à equipe_accueil : ils font partie du pool du planning
// Accueil & Intégration, donc leur statut de service doit aussi être
// pilotable ici pour que la pause se répercute sur le planning.
function isServiceRole(role, secondaryRoles = []) {
  return ['equipe_suivi', 'responsable_suivi', 'equipe_accueil'].includes(role)
    || (secondaryRoles || []).some(r => ['equipe_suivi', 'equipe_accueil'].includes(r))
}

function formatDateFR(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('fr-FR')
}

export default function UtilisateursClient({ users, fis }) {
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'equipe_suivi', sex:'F', fi_id:'', active:true, secondary_roles:[], integrator_status:'en_service', integrator_pause_until:'', planning_participant:true })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [openCategories, setOpenCategories] = useState(() => Object.fromEntries(CATEGORY_GROUPS.map(g => [g.key, true])))
  const [editingPauseDateFor, setEditingPauseDateFor] = useState(null)
  const [quickPauseDate, setQuickPauseDate] = useState('')
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
    const payload = { ...form }
    if (payload.integrator_status !== 'en_pause') payload.integrator_pause_until = null
    if (payload.integrator_pause_until === '') payload.integrator_pause_until = null
    const body = editUser ? { id: editUser.id, ...payload } : payload
    const res = await fetch('/api/users', { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const { error, warning } = await res.json()
    if (error) { alert(error); setSaving(false); return }
    setShowModal(false); setSaving(false); router.refresh()
    if (warning) alert(warning)
  }
  async function toggleActive(id, active) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, active:!active}) })
    router.refresh()
  }
  async function togglePlanningParticipant(id, current) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, planning_participant: !current}) })
    router.refresh()
  }
  async function quickSetIntegratorStatus(id, status) {
    if (status === 'en_pause') {
      setEditingPauseDateFor(id)
      setQuickPauseDate('')
      return
    }
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, integrator_status: status, integrator_pause_until: null}) })
    router.refresh()
  }
  async function confirmQuickPause(id) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      id, integrator_status: 'en_pause', integrator_pause_until: quickPauseDate || null
    }) })
    setEditingPauseDateFor(null)
    router.refresh()
  }
  async function endPauseNow(id) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, integrator_status: 'en_service', integrator_pause_until: null}) })
    router.refresh()
  }
  function openEdit(user) {
    setEditUser(user)
    setForm({ name:user.name, email:user.email, password:'', role:user.role, sex:user.sex||'F', fi_id:user.fi_id||'', active:user.active, secondary_roles:user.secondary_roles||[], integrator_status: user.integrator_status || 'en_service', integrator_pause_until: user.integrator_pause_until || '', planning_participant: user.planning_participant !== false })
    setShowModal(true)
  }
  function openAdd() {
    setEditUser(null)
    setForm({ name:'', email:'', password:'', role:'equipe_suivi', sex:'F', fi_id:'', active:true, secondary_roles:[], integrator_status:'en_service', integrator_pause_until:'', planning_participant:true })
    setShowModal(true)
  }
  const btnLabel = saving ? 'Enregistrement...' : editUser ? 'Mettre a jour' : 'Creer le compte'
  const formIsServiceRole = isServiceRole(form.role, form.secondary_roles)

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
                  <thead><tr><th>Utilisateur</th><th>Email</th><th>FI</th>
                    {g.users.some(u => isServiceRole(u.role, u.secondary_roles)) && <th>Statut de service</th>}
                    {g.users.some(u => isServiceRole(u.role, u.secondary_roles)) && <th>Planning</th>}
                    <th>Actif</th><th>Actions</th></tr></thead>
                  <tbody>
                    {g.users.map(u=>{
                      const eligible = isServiceRole(u.role, u.secondary_roles)
                      const statusInfo = INTEGRATOR_STATUS_MAP[u.integrator_status] || INTEGRATOR_STATUS_MAP.en_service
                      const isEditingPause = editingPauseDateFor === u.id
                      return (
                      <tr key={u.id}>
                        <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:'50%',background:ROLE_COLORS[u.role]||'var(--n)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700}}>{ini(u.name)}</div>
                          <div>
                            <div style={{fontSize:13,fontWeight:600}}>{u.name}</div>
                            <div style={{fontSize:11,color:'var(--gy)'}}>{u.sex==='F'?'Femme':'Homme'}
                              {(u.secondary_roles||[]).map(r => (
                                <span key={r} style={{marginLeft:6,color:'#3B82F6',fontWeight:600}}>+ {ROLES[r] || r}</span>
                              ))}
                            </div>
                          </div>
                        </div></td>
                        <td style={{fontSize:12,color:'var(--gd)'}}>{u.email}</td>
                        <td style={{fontSize:12,color:u.fi?'var(--gr)':'var(--gy)'}}>{u.fi?.name||'—'}</td>
                        {g.users.some(x => isServiceRole(x.role, x.secondary_roles)) && (
                          <td>
                            {!eligible ? (
                              <span style={{fontSize:11,color:'var(--gy)'}}>—</span>
                            ) : isEditingPause ? (
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <input type="date" value={quickPauseDate} onChange={e=>setQuickPauseDate(e.target.value)}
                                  style={{ fontSize:11, padding:'4px 6px', borderRadius:6, border:'1px solid var(--br)' }} />
                                <button onClick={()=>confirmQuickPause(u.id)} style={{ fontSize:10, fontWeight:700, background:'var(--n)', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>OK</button>
                                <button onClick={()=>setEditingPauseDateFor(null)} style={{ fontSize:10, fontWeight:700, background:'#F1F5F9', color:'#64748B', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>Annuler</button>
                              </div>
                            ) : (
                              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                                <select
                                  value={u.integrator_status || 'en_service'}
                                  onChange={e => quickSetIntegratorStatus(u.id, e.target.value)}
                                  style={{
                                    fontSize:11, fontWeight:700, padding:'4px 8px', borderRadius:8, border:'none',
                                    color: statusInfo.color, background: statusInfo.bg, cursor:'pointer'
                                  }}
                                >
                                  {INTEGRATOR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                {u.integrator_status === 'en_pause' && u.integrator_pause_until && (
                                  <span style={{ fontSize:10, color:'#9A3412', display:'flex', alignItems:'center', gap:4 }}>
                                    jusqu'au {formatDateFR(u.integrator_pause_until)}
                                    <span onClick={()=>{setEditingPauseDateFor(u.id); setQuickPauseDate(u.integrator_pause_until)}} style={{ cursor:'pointer', textDecoration:'underline' }}>modifier</span>
                                    <span onClick={()=>endPauseNow(u.id)} style={{ cursor:'pointer', textDecoration:'underline' }}>reprendre maintenant</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                        {g.users.some(x => isServiceRole(x.role, x.secondary_roles)) && (
                          <td>
                            {!eligible ? (
                              <span style={{fontSize:11,color:'var(--gy)'}}>—</span>
                            ) : (
                              <div
                                onClick={() => togglePlanningParticipant(u.id, u.planning_participant !== false)}
                                style={{
                                  cursor:'pointer', fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8,
                                  display:'inline-block',
                                  color: u.planning_participant !== false ? '#16A34A' : '#94A3B8',
                                  background: u.planning_participant !== false ? '#F0FDF4' : '#F8FAFC',
                                }}
                                title="Clique pour inclure/exclure du planning Accueil & Intégration"
                              >
                                {u.planning_participant !== false ? '✓ Inclus' : '✕ Exclu'}
                              </div>
                            )}
                          </td>
                        )}
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
                      )
                    })}
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
            <div className="form-group">
              <label className="form-label">Appartenances complémentaires</label>
              <div style={{ fontSize:11, color:'var(--gy)', marginBottom:8 }}>
                Même mécanisme que "fait aussi partie de Suivi &amp; Intégration", étendu à tous les rôles. Rend éligible aux outils et attributions de ces équipes, en plus du rôle principal.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {Object.entries(ROLES).filter(([v]) => v !== form.role).map(([v,l]) => (
                  <label key={v} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.secondary_roles.includes(v)}
                      onChange={e => setForm({
                        ...form,
                        secondary_roles: e.target.checked
                          ? [...form.secondary_roles, v]
                          : form.secondary_roles.filter(r => r !== v)
                      })}
                      style={{ width:16, height:16 }}
                    />
                    Fait également partie de {l}
                  </label>
                ))}
              </div>
            </div>

            {formIsServiceRole && (
              <div className="form-group">
                <label className="form-label">Statut de service</label>
                <div style={{ fontSize:11, color:'var(--gy)', marginBottom:8 }}>
                  Contrôle l'éligibilité à l'assignation automatique de nouveaux visiteurs (intégrateurs) ET à l'assignation automatique du planning Accueil &amp; Intégration. Une pause déclarée ici s'applique partout — pas besoin de la signaler ailleurs.
                </div>
                <div style={{ display:'flex', gap:8, marginBottom: form.integrator_status === 'en_pause' ? 10 : 0 }}>
                  {INTEGRATOR_STATUSES.map(s => (
                    <div key={s.value} onClick={()=>setForm({...form,integrator_status:s.value})} style={{
                      flex:1, padding:10, borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:700,
                      border:`2px solid ${form.integrator_status===s.value ? s.color : 'var(--br)'}`,
                      background: form.integrator_status===s.value ? s.bg : '#fff',
                      color: form.integrator_status===s.value ? s.color : '#64748B'
                    }}>
                      {s.label}
                    </div>
                  ))}
                </div>
                {form.integrator_status === 'en_pause' && (
                  <div>
                    <label className="form-label" style={{ fontSize:12 }}>En pause jusqu'au (optionnel)</label>
                    <input type="date" className="form-input" value={form.integrator_pause_until}
                      onChange={e=>setForm({...form,integrator_pause_until:e.target.value})} />
                    <div style={{ fontSize:11, color:'var(--gy)', marginTop:4 }}>
                      Repasse automatiquement "En service" le lendemain de cette date. Laisser vide pour une pause sans fin programmée.
                    </div>
                  </div>
                )}
              </div>
            )}

            {formIsServiceRole && (
              <div className="form-group">
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.planning_participant}
                    onChange={e => setForm({...form, planning_participant: e.target.checked})}
                    style={{ width:16, height:16 }}
                  />
                  Participe au planning Accueil & Intégration
                </label>
                <div style={{ fontSize:11, color:'var(--gy)', marginTop:4 }}>
                  Décoche pour exclure définitivement cette personne de l'assignation automatique du planning (ex: un admin qui ne sert pas physiquement), sans toucher à son statut de service ni à son accès à l'application.
                </div>
              </div>
            )}

            {(form.role === 'pilote_fi' || form.secondary_roles.includes('pilote_fi')) && (
              <div className="form-group"><label className="form-label">Famille Impact assignee</label>
                <select className="form-input" value={form.fi_id} onChange={e=>setForm({...form,fi_id:e.target.value})}>
                  <option value="">Selectionner...</option>
                  {fis.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  L'assigne comme pilote (ou co-pilote si un pilote existe deja) de cette FIJ.
                </div>
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
