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

const ABSENCE_REASONS = [
  { value: 'malade', label: 'Malade' },
  { value: 'deplacement', label: 'Déplacement' },
  { value: 'travail', label: 'Travail' },
  { value: 'etudes', label: 'Études' },
  { value: 'transport', label: 'Problème de transport' },
  { value: 'sans_reponse', label: 'Sans réponse' },
  { value: 'autre', label: 'Autre' }
]

const JOURNAL_TYPES = {
  priere: { label: 'Prière', icon: '🙏', color: '#7C3AED' },
  besoin: { label: 'Besoin', icon: '🆘', color: '#DC2626' },
  difficulte: { label: 'Difficulté', icon: '⚠️', color: '#D97706' },
  remarque: { label: 'Remarque', icon: '💬', color: '#0369A1' },
  action: { label: 'Action réalisée', icon: '✅', color: '#16A34A' },
  decision: { label: 'Décision', icon: '📌', color: '#334155' }
}

const TABS = [
  { id: 'dashboard', label: '📊 Tableau de bord' },
  { id: 'membres', label: '👥 Membres' },
  { id: 'presences', label: '📅 Présences' },
  { id: 'journal', label: '📝 Journal' },
  { id: 'infos', label: '⚙️ Informations' }
]

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

function hoursSince(dateStr) {
  if (!dateStr) return null
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

function nextThursday() {
  const d = new Date()
  const day = d.getDay() // 0=dim..4=jeu..6=sam
  const diff = (4 - day + 7) % 7
  d.setDate(d.getDate() + (diff === 0 ? 0 : diff))
  return d.toISOString().slice(0, 10)
}

function timeAgo(dateStr) {
  const h = hoursSince(dateStr)
  if (h === null) return ''
  if (h < 1) return 'à l\'instant'
  if (h < 24) return `il y a ${Math.floor(h)}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function FIClient({ fis, profile, profiles = [], communes = [] }) {
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
  const [activeTab, setActiveTab] = useState('dashboard')
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [unassigned, setUnassigned] = useState([])
  const [loadingUnassigned, setLoadingUnassigned] = useState(false)
  const [addingId, setAddingId] = useState('')

  // Suivi 1er contact
  const [contactingId, setContactingId] = useState(null)
  const [contactForm, setContactForm] = useState({ method: 'appel', responded: true, will_attend: true })
  const [savingContact, setSavingContact] = useState(false)

  // Présences
  const [presenceDate, setPresenceDate] = useState(nextThursday())
  const [presenceMap, setPresenceMap] = useState({}) // contact_id -> { present, reason }
  const [loadingPresence, setLoadingPresence] = useState(false)
  const [savingPresence, setSavingPresence] = useState(false)
  const [attendanceHistory, setAttendanceHistory] = useState([]) // toutes les lignes fi_attendance

  // Journal
  const [journal, setJournal] = useState([])
  const [loadingJournal, setLoadingJournal] = useState(false)
  const [journalForm, setJournalForm] = useState({ type: 'remarque', content: '', contact_id: '' })
  const [savingJournal, setSavingJournal] = useState(false)

  function canManage(fi) {
    return isAdmin || profile?.id === fi.pilot_id || profile?.id === fi.copilot_id
  }

  // ---------- Création / édition ----------

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

  // ---------- Ouverture détail ----------

  async function openDetail(fi) {
    setDetailFi(fi)
    setActiveTab('dashboard')
    setShowAddMember(false)
    setContactingId(null)
    setPresenceDate(nextThursday())
    setLoadingMembers(true)
    const { data } = await supabase.from('contacts')
      .select('id,first_name,last_name,phone,whatsapp,commune,first_visit_date,assignment_date,alert_level,integration_score,fi_contacted,fi_contacted_at,fi_contact_method,fi_contact_responded,fi_will_attend,fi_whatsapp_added,stage')
      .eq('fi_id', fi.id)
      .order('assignment_date', { ascending: false })
    setMembers(data || [])
    setLoadingMembers(false)
    // Charge en tâche de fond les données du tableau de bord (par défaut affiché)
    loadAttendanceHistory(fi)
    loadJournal(fi)
  }

  function switchTab(tab) {
    setActiveTab(tab)
    if (tab === 'presences') loadPresenceForDate(detailFi, presenceDate)
  }

  // ---------- Membres ----------

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

  function openContactForm(member) {
    setContactForm({
      method: member.fi_contact_method || 'appel',
      responded: member.fi_contact_responded ?? true,
      will_attend: member.fi_will_attend ?? true
    })
    setContactingId(member.id)
  }

  async function submitContact() {
    setSavingContact(true)
    const { error } = await supabase.from('contacts').update({
      fi_contacted: true,
      fi_contacted_at: new Date().toISOString(),
      fi_contact_method: contactForm.method,
      fi_contact_responded: contactForm.responded,
      fi_will_attend: contactForm.will_attend
    }).eq('id', contactingId)
    setSavingContact(false)
    if (error) { alert(error.message); return }
    setContactingId(null)
    await openDetail(detailFi)
  }

  async function confirmWhatsapp(contactId) {
    const { error } = await supabase.from('contacts').update({ fi_whatsapp_added: true }).eq('id', contactId)
    if (error) { alert(error.message); return }
    const member = members.find(m => m.id === contactId)
    const presentCount = attendanceHistory.filter(a => a.contact_id === contactId && a.present).length
    if (member?.stage === 'fi2' && presentCount >= 3) {
      fetch(`/api/contacts/${contactId}/stage`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage: 'integre' })
      }).catch(console.error)
    }
    await openDetail(detailFi)
  }

  // ---------- Présences ----------

  async function loadPresenceForDate(fi, date) {
    if (!fi) return
    setLoadingPresence(true)
    const { data } = await supabase.from('fi_attendance')
      .select('contact_id, present, notes')
      .eq('fi_id', fi.id)
      .eq('date', date)
    const map = {}
    members.forEach(m => { map[m.id] = { present: true, reason: '' } })
    ;(data || []).forEach(row => {
      map[row.contact_id] = { present: row.present, reason: row.notes || '' }
    })
    setPresenceMap(map)
    setLoadingPresence(false)
  }

  function onPresenceDateChange(date) {
    setPresenceDate(date)
    loadPresenceForDate(detailFi, date)
  }

  function togglePresence(contactId, present) {
    setPresenceMap(prev => ({ ...prev, [contactId]: { present, reason: present ? '' : (prev[contactId]?.reason || 'sans_reponse') } }))
  }

  function setAbsenceReason(contactId, reason) {
    setPresenceMap(prev => ({ ...prev, [contactId]: { ...prev[contactId], reason } }))
  }

  async function savePresence() {
    if (!detailFi) return
    setSavingPresence(true)
    await supabase.from('fi_attendance').delete().eq('fi_id', detailFi.id).eq('date', presenceDate)
    const rows = members.map(m => ({
      fi_id: detailFi.id,
      contact_id: m.id,
      date: presenceDate,
      present: presenceMap[m.id]?.present ?? true,
      notes: presenceMap[m.id]?.present ? null : (presenceMap[m.id]?.reason || 'sans_reponse'),
      recorded_by: profile.id
    }))
    const { error } = await supabase.from('fi_attendance').insert(rows)
    setSavingPresence(false)
    if (error) { alert(error.message); return }
    await loadAttendanceHistory(detailFi)

    // Avancement automatique du pipeline (invite_fi -> fi1 -> fi2) selon le nb de présences
    const { data: freshHistory } = await supabase.from('fi_attendance')
      .select('contact_id, present').eq('fi_id', detailFi.id).eq('present', true)
    const counts = {}
    ;(freshHistory || []).forEach(r => { counts[r.contact_id] = (counts[r.contact_id] || 0) + 1 })
    for (const m of members) {
      const count = counts[m.id] || 0
      let target = null
      if (count === 1 && m.stage === 'invite_fi') target = 'fi1'
      else if (count === 2 && m.stage === 'fi1') target = 'fi2'
      if (target) {
        fetch(`/api/contacts/${m.id}/stage`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newStage: target })
        }).catch(console.error)
      }
    }

    alert('Présences enregistrées.')
  }

  async function loadAttendanceHistory(fi) {
    const { data } = await supabase.from('fi_attendance')
      .select('date, present, contact_id')
      .eq('fi_id', fi.id)
      .order('date', { ascending: true })
    setAttendanceHistory(data || [])
  }

  // ---------- Journal ----------

  async function loadJournal(fi) {
    setLoadingJournal(true)
    const { data } = await supabase.from('fi_journal')
      .select('id,type,content,created_at,contact_id,author:profiles(name),contact:contacts(first_name,last_name)')
      .eq('fi_id', fi.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setJournal(data || [])
    setLoadingJournal(false)
  }

  async function submitJournal() {
    if (!journalForm.content.trim()) return
    setSavingJournal(true)
    const { error } = await supabase.from('fi_journal').insert({
      fi_id: detailFi.id,
      contact_id: journalForm.contact_id || null,
      author_id: profile.id,
      type: journalForm.type,
      content: journalForm.content.trim()
    })
    setSavingJournal(false)
    if (error) { alert(error.message); return }
    setJournalForm({ type: 'remarque', content: '', contact_id: '' })
    await loadJournal(detailFi)
  }

  // ---------- Rendu ----------

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

      {/* ---- Modale détail : espace de pilotage ---- */}
      {detailFi && (
        <div onClick={() => setDetailFi(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 820 }}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{detailFi.name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>{detailFi.commune_name} · {detailFi.day} à {detailFi.time}</div>
              </div>
              <button onClick={() => setDetailFi(null)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0', borderBottom: '1px solid #E2E8F0', overflowX: 'auto' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px',
                  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  color: activeTab === t.id ? 'var(--n)' : '#94A3B8',
                  borderBottom: activeTab === t.id ? '2px solid var(--n)' : '2px solid transparent'
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ padding: 20 }}>

              {/* === TABLEAU DE BORD === */}
              {activeTab === 'dashboard' && (
                <DashboardTab detailFi={detailFi} members={members} attendanceHistory={attendanceHistory} journal={journal} />
              )}

              {/* === MEMBRES === */}
              {activeTab === 'membres' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Membres ({members.length}/{detailFi.capacity})</div>
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
                      {members.map(m => {
                        const late = !m.fi_contacted && hoursSince(m.assignment_date) > 48
                        const presentCount = attendanceHistory.filter(a => a.contact_id === m.id && a.present).length
                        const whatsappEligible = presentCount >= 3 && !m.fi_whatsapp_added
                        return (
                          <div key={m.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.first_name} {m.last_name}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{m.phone || m.whatsapp || '—'} {m.commune ? `· ${m.commune}` : ''}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {m.alert_level && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badgeColor(m.alert_level), padding: '2px 8px', borderRadius: 999 }}>{m.alert_level}</span>
                                )}
                                {m.fi_contacted ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: 999 }}>✅ Contacté ({m.fi_contact_method})</span>
                                ) : late ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#DC2626', padding: '2px 8px', borderRadius: 999 }}>⏰ +48h sans contact</span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 }}>À contacter</span>
                                )}
                                {m.fi_whatsapp_added && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: 999 }}>💬 Dans le groupe</span>
                                )}
                                {whatsappEligible && (
                                  <button onClick={() => confirmWhatsapp(m.id)} style={{ ...smallBtnStyle, background: '#DCFCE7', color: '#166534' }}>🎉 Confirmer ajout groupe WhatsApp</button>
                                )}
                                {canManage(detailFi) && (
                                  <button onClick={() => openContactForm(m)} style={smallBtnStyle}>{m.fi_contacted ? 'Modifier' : 'Confirmer contact'}</button>
                                )}
                                {canManage(detailFi) && (
                                  <button onClick={() => removeMember(m.id)} style={{ ...smallBtnStyle, color: '#DC2626' }}>Retirer</button>
                                )}
                              </div>
                            </div>

                            {contactingId === m.id && (
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <select value={contactForm.method} onChange={e => setContactForm({ ...contactForm, method: e.target.value })} style={inputStyle}>
                                  <option value="appel">📞 Appel</option>
                                  <option value="whatsapp">💬 WhatsApp</option>
                                  <option value="sms">✉️ SMS</option>
                                  <option value="autre">Autre</option>
                                </select>
                                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={contactForm.responded} onChange={e => setContactForm({ ...contactForm, responded: e.target.checked })} />
                                  A répondu
                                </label>
                                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={contactForm.will_attend} onChange={e => setContactForm({ ...contactForm, will_attend: e.target.checked })} />
                                  Viendra à la prochaine FIJ
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => setContactingId(null)} style={secondaryBtnStyle}>Annuler</button>
                                  <button onClick={submitContact} disabled={savingContact} style={primaryBtnStyle}>{savingContact ? 'Enregistrement…' : 'Enregistrer'}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* === PRESENCES === */}
              {activeTab === 'presences' && (
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                    <Field label="Séance du" style={{ flex: 1, maxWidth: 200 }}>
                      <input type="date" value={presenceDate} onChange={e => onPresenceDateChange(e.target.value)} style={inputStyle} />
                    </Field>
                    {canManage(detailFi) && (
                      <button onClick={savePresence} disabled={savingPresence || loadingPresence} style={{ ...primaryBtnStyle, flex: 'none', marginTop: 18 }}>
                        {savingPresence ? 'Enregistrement…' : 'Enregistrer la séance'}
                      </button>
                    )}
                  </div>

                  {loadingPresence ? (
                    <div style={{ fontSize: 13, color: '#94A3B8' }}>Chargement…</div>
                  ) : members.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucun membre à pointer pour cette FIJ.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                      {members.map(m => {
                        const p = presenceMap[m.id] || { present: true, reason: '' }
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', borderRadius: 10, padding: '8px 14px' }}>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{m.first_name} {m.last_name}</div>
                            <button onClick={() => togglePresence(m.id, true)} style={{ ...smallBtnStyle, background: p.present ? '#DCFCE7' : '#fff', color: p.present ? '#166534' : '#334155' }}>Présent</button>
                            <button onClick={() => togglePresence(m.id, false)} style={{ ...smallBtnStyle, background: !p.present ? '#FEE2E2' : '#fff', color: !p.present ? '#DC2626' : '#334155' }}>Absent</button>
                            {!p.present && (
                              <select value={p.reason} onChange={e => setAbsenceReason(m.id, e.target.value)} style={{ ...inputStyle, width: 160 }}>
                                {ABSENCE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique des séances</div>
                  <AttendanceHistoryList history={attendanceHistory} onPick={onPresenceDateChange} />
                </div>
              )}

              {/* === JOURNAL === */}
              {activeTab === 'journal' && (
                <div>
                  {canManage(detailFi) && (
                    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={journalForm.type} onChange={e => setJournalForm({ ...journalForm, type: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                          {Object.entries(JOURNAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                        </select>
                        <select value={journalForm.contact_id} onChange={e => setJournalForm({ ...journalForm, contact_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                          <option value="">Concerne toute la FIJ</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                        </select>
                      </div>
                      <textarea value={journalForm.content} onChange={e => setJournalForm({ ...journalForm, content: e.target.value })} placeholder="Écris ta note ici…" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                      <button onClick={submitJournal} disabled={savingJournal || !journalForm.content.trim()} style={{ ...primaryBtnStyle, alignSelf: 'flex-end', flex: 'none', padding: '8px 20px' }}>
                        {savingJournal ? 'Envoi…' : 'Ajouter au journal'}
                      </button>
                    </div>
                  )}

                  {loadingJournal ? (
                    <div style={{ fontSize: 13, color: '#94A3B8' }}>Chargement…</div>
                  ) : journal.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucune note pour le moment.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {journal.map(entry => {
                        const t = JOURNAL_TYPES[entry.type] || JOURNAL_TYPES.remarque
                        return (
                          <div key={entry.id} style={{ borderLeft: `3px solid ${t.color}`, background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{t.icon} {t.label}{entry.contact ? ` · ${entry.contact.first_name} ${entry.contact.last_name}` : ''}</span>
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>{entry.author?.name || '—'} · {timeAgo(entry.created_at)}</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap' }}>{entry.content}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* === INFORMATIONS === */}
              {activeTab === 'infos' && (
                <div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                    <InfoLine label="Statut" value={statusInfo(detailFi.status).label} />
                    <InfoLine label="Pilote" value={detailFi.pilot?.name || '—'} />
                    <InfoLine label="Co-pilote" value={detailFi.copilot?.name || '—'} />
                    <InfoLine label="Adresse" value={detailFi.address || '—'} />
                    <InfoLine label="Membres" value={`${detailFi.memberCount}/${detailFi.capacity}`} />
                    <InfoLine label="Quartiers" value={(detailFi.quartiers || []).join(', ') || '—'} />
                  </div>

                  {detailFi.notes && (
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, color: '#475569', marginBottom: 16 }}>
                      {detailFi.notes}
                    </div>
                  )}

                  {canManage(detailFi) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setDetailFi(null); openEdit(detailFi) }} style={secondaryBtnStyle}>Modifier</button>
                      {isAdmin && <button onClick={() => deleteFi(detailFi)} style={{ ...secondaryBtnStyle, color: '#DC2626', borderColor: '#FCA5A5' }}>Supprimer</button>}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Sous-composants ----------

function DashboardTab({ detailFi, members, attendanceHistory, journal }) {
  const totalMembers = members.length
  const contacted = members.filter(m => m.fi_contacted).length
  const alerts = members.filter(m => m.alert_level).length
  const lateContacts = members.filter(m => !m.fi_contacted && hoursSince(m.assignment_date) > 48).length

  const byDate = {}
  attendanceHistory.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { present: 0, total: 0 }
    byDate[r.date].total++
    if (r.present) byDate[r.date].present++
  })
  const dates = Object.keys(byDate).sort().slice(-8)
  const overallTotal = attendanceHistory.length
  const overallPresent = attendanceHistory.filter(r => r.present).length
  const attendanceRate = overallTotal ? Math.round((overallPresent / overallTotal) * 100) : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
        <StatCard label="Membres" value={`${totalMembers}/${detailFi.capacity}`} />
        <StatCard label="Contactés" value={`${contacted}/${totalMembers}`} color={contacted === totalMembers ? 'var(--gr)' : undefined} />
        <StatCard label="En retard (+48h)" value={lateContacts} color={lateContacts > 0 ? '#DC2626' : undefined} />
        <StatCard label="Alertes" value={alerts} color={alerts > 0 ? '#DC2626' : undefined} />
        <StatCard label="Taux présence" value={attendanceRate !== null ? `${attendanceRate}%` : '—'} />
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Évolution de la présence (dernières séances)</div>
      {dates.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Pas encore de séance enregistrée — va dans l'onglet Présences.</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, marginBottom: 24, padding: '0 4px' }}>
          {dates.map(d => {
            const rate = Math.round((byDate[d].present / byDate[d].total) * 100)
            return (
              <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10, color: '#64748B' }}>{rate}%</div>
                <div style={{ width: '100%', height: Math.max(4, rate), background: rate > 70 ? 'var(--gr)' : rate > 40 ? 'var(--or)' : '#DC2626', borderRadius: 4 }} />
                <div style={{ fontSize: 9, color: '#94A3B8' }}>{d.slice(5)}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Dernières notes du journal</div>
      {journal.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucune note pour le moment.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {journal.slice(0, 5).map(entry => {
            const t = JOURNAL_TYPES[entry.type] || JOURNAL_TYPES.remarque
            return (
              <div key={entry.id} style={{ fontSize: 12, color: '#334155' }}>
                <span style={{ fontWeight: 700, color: t.color }}>{t.icon} {t.label} :</span> {entry.content.slice(0, 100)}{entry.content.length > 100 ? '…' : ''}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AttendanceHistoryList({ history, onPick }) {
  const byDate = {}
  history.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { present: 0, total: 0 }
    byDate[r.date].total++
    if (r.present) byDate[r.date].present++
  })
  const dates = Object.keys(byDate).sort().reverse()
  if (dates.length === 0) return <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucune séance enregistrée.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dates.map(d => (
        <button key={d} onClick={() => onPick(d)} style={{ ...smallBtnStyle, textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
          <span>{d}</span>
          <span>{byDate[d].present}/{byDate[d].total} présents</span>
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || '#1E293B' }}>{value}</div>
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
