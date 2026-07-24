'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const emptyForm = {
  name: '', commune_id: '', address: '', quartiers: '',
  pilot_id: '', copilot_id: '', day: 'Jeudi', time: '19:00',
  capacity: 15, status: 'en_developpement', notes: ''
}

function badgeColor(level) {
  if (level === 'urgent' || level === 'rouge') return '#DC2626'
  if (level === 'orange') return 'var(--or)'
  return 'var(--gr)'
}

function statusInfo(status) {
  if (status === 'active') return { label: '✅ Active', dim: false }
  if (status === 'en_pause') return { label: '⏸️ En pause', dim: true }
  if (status === 'fermee') return { label: '⛔ Fermée', dim: true }
  return { label: '🔄 En développement', dim: false }
}

export default function FIClient({ fis, profile, profiles, communes }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const isAdmin = ['admin'].includes(profile?.role)

  // Modale création / édition
  const [showForm, setShowForm] = useState(false)
  const [editingFi, setEditingFi] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Modale détail
  const [detailFi, setDetailFi] = useState(null)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [unassigned, setUnassigned] = useState([])
  const [loadingUnassigned, setLoadingUnassigned] = useState(false)
  const [addingId, setAddingId] = useState('')

  function canManage(fi) {
    return isAdmin || profile?.id === fi.pilot_id || profile?.id === fi.copilot_id
  }

  function openCreate() {
    setEditingFi(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(fi) {
    setEditingFi(fi)
    setForm({
      name: fi.name || '',
      commune_id: fi.commune_id || '',
      address: fi.address || '',
      quartiers: (fi.quartiers || []).join(', '),
      pilot_id: fi.pilot_id || '',
      copilot_id: fi.copilot_id || '',
      day: fi.day || 'Jeudi',
      time: fi.time || '19:00',
      capacity: fi.capacity || 15,
      status: fi.status || 'en_developpement',
      notes: fi.notes || ''
    })
    setFormError('')
    setShowForm(true)
  }

  async function submitForm(e) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Le nom est requis.'); return }
    setSaving(true)
    setFormError('')

    const commune = communes.find(c => c.id === form.commune_id)
    const payload = {
      name: form.name.trim(),
      commune_id: form.commune_id || null,
      commune_name: commune?.name || null,
      address: form.address.trim() || null,
      quartiers: form.quartiers.split(',').map(q => q.trim()).filter(Boolean),
      pilot_id: form.pilot_id || null,
      copilot_id: form.copilot_id || null,
      day: form.day,
      time: form.time,
      capacity: Number(form.capacity) || 15,
      status: form.status,
      notes: form.notes.trim() || null
    }

    const query = editingFi
      ? supabase.from('familles_impact').update(payload).eq('id', editingFi.id)
      : supabase.from('familles_impact').insert(payload)

    const { error } = await query
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setShowForm(false)
    router.refresh()
  }

  async function deleteFi(fi) {
    if (fi.memberCount > 0) {
      alert('Cette FIJ contient encore des membres. Réattribue-les à une autre FIJ avant de la supprimer.')
      return
    }
    if (!confirm(`Supprimer la FIJ "${fi.name}" ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('familles_impact').delete().eq('id', fi.id)
    if (error) { alert(error.message); return }
    setDetailFi(null)
    router.refresh()
  }

  async function openDetail(fi) {
    setDetailFi(fi)
    setShowAddMember(false)
    setLoadingMembers(true)
    const { data } = await supabase.from('contacts')
      .select('id,first_name,last_name,phone,whatsapp,commune,first_visit_date,assignment_date,alert_level,integration_score')
      .eq('fi_id', fi.id)
      .order('assignment_date', { ascending: false })
    setMembers(data || [])
    setLoadingMembers(false)
  }

  async function loadUnassigned() {
    setLoadingUnassigned(true)
    const { data } = await supabase.from('contacts')
      .select('id,first_name,last_name,commune')
      .is('fi_id', null)
      .order('created_at', { ascending: false })
      .limit(200)
    setUnassigned(data || [])
    setLoadingUnassigned(false)
    setShowAddMember(true)
  }

  async function addMember() {
    if (!addingId) return
    const { error } = await supabase.from('contacts').update({
      fi_id: detailFi.id,
      assigned_to: profile.id,
      assignment_date: new Date().toISOString()
    }).eq('id', addingId)
    if (error) { alert(error.message); return }
    setAddingId('')
    setShowAddMember(false)
    await openDetail(detailFi)
    router.refresh()
  }

  async function removeMember(contactId) {
    if (!confirm('Retirer ce contact de la FIJ ?')) return
    const { error } = await supabase.from('contacts').update({
      fi_id: null, assigned_to: null, assignment_date: null
    }).eq('id', contactId)
    if (error) { alert(error.message); return }
    await openDetail(detailFi)
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="g3">
        {fis.map(fi => {
          const pct = Math.round((fi.memberCount / fi.capacity) * 100)
          const st = statusInfo(fi.status)
          return (
            <div key={fi.id} onClick={() => openDetail(fi)} className="card" style={{ cursor: 'pointer', overflow: 'hidden', padding: 0, opacity: st.dim ? .6 : 1 }}>
              <div style={{ padding: '20px 20px 44px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', border: '2px solid rgba(255,255,255,.1)' }} />
                <div style={{ fontSize: 10, opacity: .7, letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>{fi.commune_name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fi.name}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,.2)', padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
                </div>
              </div>
              <div style={{ padding: 20, marginTop: -24, position: 'relative', zIndex: 1 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--gd)' }}>Capacité</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct > 85 ? 'var(--or)' : 'var(--gr)' }}>{fi.memberCount}/{fi.capacity}</span>
                  </div>
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--or)' : 'var(--gr)', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>👤</span><span style={{ fontSize: 12 }}>Pilote : <b>{fi.pilot?.name || '—'}</b></span></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>📅</span><span style={{ fontSize: 12 }}>{fi.day} à {fi.time}</span></div>
                </div>
              </div>
            </div>
          )
        })}
        {isAdmin && (
          <div onClick={openCreate} className="card" style={{ border: '2px dashed #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, cursor: 'pointer', minHeight: 200 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✚</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Ouvrir une nouvelle FI</div>
          </div>
        )}
      </div>

      {/* ---- Modale création / édition ---- */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 520 }}>
            <div style={modalHeaderStyle}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{editingFi ? 'Modifier la FIJ' : 'Nouvelle FIJ'}</div>
              <button onClick={() => setShowForm(false)} style={closeBtnStyle}>✕</button>
            </div>
            <form onSubmit={submitForm} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formError && <div style={errorBoxStyle}>{formError}</div>}

              <Field label="Nom de la FIJ *">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ex : FIJ Les Abymes Centre" />
              </Field>

              <Field label="Commune">
                <select value={form.commune_id} onChange={e => setForm({ ...form, commune_id: e.target.value })} style={inputStyle}>
                  <option value="">— Sélectionner —</option>
                  {communes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Adresse">
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={inputStyle} placeholder="Adresse du lieu de rencontre" />
              </Field>

              <Field label="Quartiers couverts (séparés par des virgules)">
                <input value={form.quartiers} onChange={e => setForm({ ...form, quartiers: e.target.value })} style={inputStyle} placeholder="Ex : Bisdary, Grand Camp" />
              </Field>

              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Pilote (vide si compte pas encore créé)" style={{ flex: 1 }}>
                  <select value={form.pilot_id} onChange={e => setForm({ ...form, pilot_id: e.target.value })} style={inputStyle}>
                    <option value="">— Sélectionner —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Co-pilote" style={{ flex: 1 }}>
                  <select value={form.copilot_id} onChange={e => setForm({ ...form, copilot_id: e.target.value })} style={inputStyle}>
                    <option value="">— Aucun —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Jour" style={{ flex: 1 }}>
                  <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} style={inputStyle}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Heure" style={{ flex: 1 }}>
                  <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Capacité" style={{ flex: 1 }}>
                  <input type="number" min={1} max={30} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} style={inputStyle} />
                </Field>
              </div>

              <Field label="Statut">
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  <option value="en_developpement">🔄 En développement</option>
                  <option value="active">✅ Active</option>
                  <option value="en_pause">⏸️ En pause (fermeture temporaire)</option>
                  <option value="fermee">⛔ Fermée définitivement</option>
                </select>
              </Field>

              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
              </Field>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={secondaryBtnStyle}>Annuler</button>
                <button type="submit" disabled={saving} style={primaryBtnStyle}>{saving ? 'Enregistrement…' : (editingFi ? 'Enregistrer' : 'Créer la FIJ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Modale détail ---- */}
      {detailFi && (
        <div onClick={() => setDetailFi(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{detailFi.name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>{detailFi.commune_name} · {detailFi.day} à {detailFi.time}</div>
              </div>
              <button onClick={() => setDetailFi(null)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                <InfoLine label="Statut" value={statusInfo(detailFi.status).label} />
                <InfoLine label="Pilote" value={detailFi.pilot?.name || '—'} />
                <InfoLine label="Co-pilote" value={detailFi.copilot?.name || '—'} />
                <InfoLine label="Adresse" value={detailFi.address || '—'} />
                <InfoLine label="Membres" value={`${detailFi.memberCount}/${detailFi.capacity}`} />
              </div>

              {detailFi.notes && (
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, color: '#475569', marginBottom: 16 }}>
                  {detailFi.notes}
                </div>
              )}

              {canManage(detailFi) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => { setDetailFi(null); openEdit(detailFi) }} style={secondaryBtnStyle}>Modifier</button>
                  {isAdmin && <button onClick={() => deleteFi(detailFi)} style={{ ...secondaryBtnStyle, color: '#DC2626', borderColor: '#FCA5A5' }}>Supprimer</button>}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Membres ({members.length})</div>
                {canManage(detailFi) && (
                  <button onClick={loadUnassigned} style={smallBtnStyle}>+ Ajouter un membre</button>
                )}
              </div>

              {showAddMember && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <select value={addingId} onChange={e => setAddingId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">{loadingUnassigned ? 'Chargement…' : '— Sélectionner un contact non affecté —'}</option>
                    {unassigned.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.commune ? ` (${c.commune})` : ''}</option>)}
                  </select>
                  <button onClick={addMember} style={primaryBtnStyle}>Ajouter</button>
                </div>
              )}

              {loadingMembers ? (
                <div style={{ fontSize: 13, color: '#94A3B8' }}>Chargement des membres…</div>
              ) : members.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucun membre rattaché pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{m.first_name} {m.last_name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{m.phone || m.whatsapp || '—'} {m.commune ? `· ${m.commune}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.alert_level && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor(m.alert_level), padding: '2px 8px', borderRadius: 999 }}>{m.alert_level}</span>
                        )}
                        {canManage(detailFi) && (
                          <button onClick={() => removeMember(m.id)} style={{ ...smallBtnStyle, color: '#DC2626' }}>Retirer</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{value}</div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
}

const modalStyle = {
  background: '#fff', borderRadius: 16, width: '100%', maxHeight: '90vh',
  overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)'
}

const modalHeaderStyle = {
  padding: '18px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)',
  color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'sticky', top: 0, zIndex: 1
}

const closeBtnStyle = {
  background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28,
  borderRadius: 8, cursor: 'pointer', fontSize: 14
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'
}

const primaryBtnStyle = {
  background: 'var(--n)', color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1
}

const secondaryBtnStyle = {
  background: '#fff', color: '#374151', border: '1px solid #E2E8F0', padding: '10px 18px',
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1
}

const smallBtnStyle = {
  background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '5px 10px',
  borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer'
}

const errorBoxStyle = {
  background: '#FEF2F2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: 12
}
