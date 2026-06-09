'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES } from '@/lib/constants'
const ROLE_COLORS = { admin:'#EF4444', responsable_integration:'#F97316', equipe_integration:'#F59E0B', responsable_suivi:'#8B5CF6', equipe_suivi:'#3B82F6', pilote_fi:'#22C55E', superviseur:'#0B3D91', responsable_jeunesse:'#06B6D4' }
const ini = (nm) => nm?.split(' ').map(w=>w[0]).slice(0,2).join('') || 'U'
export default function UtilisateursClient({ users, fis }) {
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'equipe_integration', sex:'F', fi_id:'', active:true })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  async function saveUser() {
    setSaving(true)
    const url = editUser ? '/api/users' : '/api/users'
    const method = editUser ? 'PATCH' : 'POST'
    const body = editUser ? { id: editUser.id, ...form } : form
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
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
    setForm({ name:user.name, email:user.email, password:'', role:user.role, sex:user.sex||'F', fi_id:user.fi_id||'', active:user.active })
    setShowModal(true)
  }
  function openAdd() {
    setEditUser(null)
    setForm({ name:'', email:'', password:'', role:'equipe_integration', sex:'F', fi_id:'', active:true })
    setShowModal(true)
  }
  return (
    <div style={{maxWidth:1000}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div style={{fontSize:14,color:'var(--gy)'}}>{users.length} utilisateur(s)</div>
        <button onClick={openAdd} className="btn btn-primary">✚ Nouvel utilisateur</button>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>FI</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id}>
                <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:ROLE_COLORS[u.role]||'var(--n)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700}}>{ini(u.name)}</div>
                  <div><div style={{fontSize:13,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:'var(--gy)'}}>{u.sex==='F'?'Femme':'Homme'}</div></div>
                </div></td>
                <td style={{fontSize:12,color:'var(--gd)'}}>{u.email}</td>
                <td><span className="badge" style={{background:`${ROLE_COLORS[u.role]||'#94A3B8'}20`,color:ROLE_COLORS[u.role]||'#94A3B8'}}>{ROLES[u.role]||u.role}</span></td>
                <td style={{fontSize:12,color:u.fi?'var(--gr)':'var(--gy)'}}>{u.fi?.name||'—'}</td>
                <td>
                  <div className={`tog ${u.active?'on':'off'}`} onClick={()=>toggleActive(u.id,u.active)} style={{cursor:'pointer'}}>
                    <div className="tog-th" />
                  </div>
                </td>
                <td><div style={{display:'flex',gap:4}}>
                  <div onClick={()=>openEdit(u)} style={{width:28,height:28,borderRadius:8,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13}}>✏️</div>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div style={{fontSize:18,fontWeight:700}}>{editUser?'Modifier utilisateur':'Nouvel utilisateur'}</div>
              <button onClick={()=>setShowModal(false)} style={{width:32,height:32,borderRadius:8,background:'#F1F5F9',border:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} disabled={!!editUser} /></div>
            <div className="form-group"><label className="form-label">{editUser?'Nouveau mot de passe (laisser vide = inchangé)':'Mot de passe *'}</label><input type="password" className="form-input" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={editUser?'Laisser vide pour ne pas changer':'••••••••'} /></div>
            <div className="form-group"><label className="form-label">Rôle</label>
              <select className="form-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                {Object.entries(ROLES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Sexe</label>
              <div style={{display:'flex',gap:8}}>
                {[['F','👩 Femme'],['M','👨 Homme']].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm({...form,sex:v})} style={{flex:1,padding:10,borderRadius:10,border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`,background:form.sex===v?'rgba(11,61,145,.08)':'#fff',textAlign:'center',fontSize:13,fontWeight:600,color:form.sex===v?'var(--n)':'#64748B',cursor:'pointer'}}>{l}</div>
                ))}
              </div>
            </div>
            {form.role === 'pilote_fi' && (
              <div className="form-group"><label className="form-label">Famille d'Impact assignée</label>
                <select className="form-input" value={form.fi_id} onChange={e=>setForm({...form,fi_id:e.target.value})}>
                  <option value="">— Sélectionner —</option>
                  {fis.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div style={{display:'flex',gap:12,marginTop:8}}>
              <button onClick={()=>setShowModal(false)} className="btn btn-secondary" style={{flex:1}}>Annuler</button>
              <button onClick={saveUser} disabled={saving} className="btn btn-primary" style={{flex:2}}>
                {saving?'⏳ Enregistrement…':editUser?'Mettre à jour':'Créer l'utilisateur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
