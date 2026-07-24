'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'

export default function ContactDetailModal({ contactId, onClose, communes = [], fis = [] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  const [confirmingContact, setConfirmingContact] = useState(false)
  const [contactChannel, setContactChannel] = useState('appel')
  const [contactNote, setContactNote] = useState('')

  const [changingStage, setChangingStage] = useState(false)
  const [newStage, setNewStage] = useState('')
  const [stageWarning, setStageWarning] = useState('')

  const [history, setHistory] = useState([])

  useEffect(() => {
    if (contactId) load()
  }, [contactId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('contacts')
      .select('*, fi:familles_impact(id,name), agent:profiles!contacts_assigned_to_fkey(id,name)')
      .eq('id', contactId).single()
    setContact(data)
    setForm(data ? {
      first_name: data.first_name || '', last_name: data.last_name || '',
      phone: data.phone || '', whatsapp: data.whatsapp || '', email: data.email || '',
      commune_id: data.commune_id || '', quartier: data.quartier || '',
      fi_id: data.fi_id || '', prayer_request: data.prayer_request || '',
      situation: data.situation || '', baptism_date: data.baptism_date || ''
    } : null)
    setNewStage(data?.stage || '')
    setLoading(false)

    const { data: auditRows } = await supabase.from('audit_log')
      .select('id,action,details,created_at,performed_by')
      .eq('entity_type', 'contact').eq('entity_id', contactId)
      .order('created_at', { ascending: false }).limit(15)
    const ids = [...new Set((auditRows || []).map(r => r.performed_by).filter(Boolean))]
    let names = {}
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,name').in('id', ids)
      names = Object.fromEntries((profs || []).map(p => [p.id, p.name]))
    }
    setHistory((auditRows || []).map(r => ({ ...r, authorName: names[r.performed_by] || '—' })))
  }

  async function saveForm() {
    setSaving(true)
    const commune = communes.find(c => c.id === form.commune_id)
    const { error } = await supabase.from('contacts').update({
      first_name: form.first_name, last_name: form.last_name,
      phone: form.phone, whatsapp: form.whatsapp, email: form.email,
      commune_id: form.commune_id || null, commune: commune?.name || contact.commune,
      quartier: form.quartier, fi_id: form.fi_id || null,
      prayer_request: form.prayer_request, situation: form.situation,
      baptism_date: form.baptism_date || null
    }).eq('id', contactId)
    setSaving(false)
    if (error) { alert(error.message); return }
    await load()
    router.refresh()
  }

  async function submitContactConfirmation() {
    const { data: { session } } = await supabase.auth.getSession()
    const now = new Date().toISOString()
    const { error } = await supabase.from('contacts').update({ last_contact_at: now }).eq('id', contactId)
    if (error) { alert(error.message); return }
    await supabase.from('communication_logs').insert({
      contact_id: contactId, channel: contactChannel, direction: 'outbound',
      content: contactNote || `Contact effectué (${contactChannel})`,
      sent_by: session?.user?.id, sent_at: now, status: 'sent'
    })
    setConfirmingContact(false)
    setContactNote('')
    await load()
  }

  async function submitStageChange() {
    if (!newStage || newStage === contact.stage) { setChangingStage(false); return }
    const res = await fetch(`/api/contacts/${contactId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStage })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setStageWarning(data.warning || '')
    setChangingStage(false)
    await load()
    router.refresh()
  }

  function nextStageId(current) {
    const idx = STAGES.findIndex(s => s.id === current)
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1].id : null
  }

  if (!contactId) return null

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 680 }}>
        {loading || !contact ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{contact.first_name} {contact.last_name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>{contact.commune || '—'} {contact.is_minor && '· Mineur'}</div>
              </div>
              <button onClick={onClose} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Étape du pipeline */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: changingStage ? 10 : 0 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Étape actuelle</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STAGE_COLOR(contact.stage) }}>{STAGE_LABEL(contact.stage)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {nextStageId(contact.stage) && (
                      <button onClick={() => { setNewStage(nextStageId(contact.stage)); submitStageChange() }} style={smallBtnStyle}>Étape suivante →</button>
                    )}
                    <button onClick={() => setChangingStage(v => !v)} style={smallBtnStyle}>Changer d'étape</button>
                  </div>
                </div>
                {changingStage && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select value={newStage} onChange={e => setNewStage(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                    </select>
                    <button onClick={submitStageChange} style={primaryBtnStyle}>Valider</button>
                  </div>
                )}
                {stageWarning && (
                  <div style={{ marginTop: 10, fontSize: 12, background: '#FFF7ED', color: '#9A3412', padding: '8px 12px', borderRadius: 8 }}>
                    ⚠️ {stageWarning} (l'étape a quand même été changée)
                  </div>
                )}
              </div>

              {/* Confirmation de contact */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Dernier contact : <b>{contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleString('fr-FR') : 'jamais'}</b>
                </div>
                <button onClick={() => setConfirmingContact(v => !v)} style={smallBtnStyle}>Confirmer un contact</button>
              </div>
              {confirmingContact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                  <select value={contactChannel} onChange={e => setContactChannel(e.target.value)} style={inputStyle}>
                    <option value="appel">📞 Appel</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="sms">✉️ SMS</option>
                    <option value="email">📧 Email</option>
                  </select>
                  <input value={contactNote} onChange={e => setContactNote(e.target.value)} placeholder="Note (optionnel)" style={inputStyle} />
                  <button onClick={submitContactConfirmation} style={primaryBtnStyle}>Enregistrer le contact</button>
                </div>
              )}

              {/* Fiche éditable */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Prénom" style={{ flex: 1 }}><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inputStyle} /></Field>
                  <Field label="Nom" style={{ flex: 1 }}><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Téléphone" style={{ flex: 1 }}><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} /></Field>
                  <Field label="WhatsApp" style={{ flex: 1 }}><input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={inputStyle} /></Field>
                </div>
                <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} /></Field>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Commune" style={{ flex: 1 }}>
                    <select value={form.commune_id} onChange={e => setForm({ ...form, commune_id: e.target.value })} style={inputStyle}>
                      <option value="">—</option>
                      {communes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Quartier" style={{ flex: 1 }}><input value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })} style={inputStyle} /></Field>
                </div>
                <Field label="FIJ attribuée">
                  <select value={form.fi_id} onChange={e => setForm({ ...form, fi_id: e.target.value })} style={inputStyle}>
                    <option value="">— Aucune —</option>
                    {fis.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Field>
                <Field label="Demande de prière"><textarea value={form.prayer_request} onChange={e => setForm({ ...form, prayer_request: e.target.value })} style={{ ...inputStyle, minHeight: 50 }} /></Field>
                <Field label="Situation / notes"><textarea value={form.situation} onChange={e => setForm({ ...form, situation: e.target.value })} style={{ ...inputStyle, minHeight: 50 }} /></Field>
                <Field label="Date de baptême"><input type="date" value={form.baptism_date} onChange={e => setForm({ ...form, baptism_date: e.target.value })} style={inputStyle} /></Field>

                <button onClick={saveForm} disabled={saving} style={{ ...primaryBtnStyle, alignSelf: 'flex-start', flex: 'none', padding: '8px 20px' }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>

              {/* Historique */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Aucune action enregistrée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ fontSize: 11, color: '#64748B' }}>
                      <b>{h.authorName}</b> — {h.action}
                      {h.details?.from && h.details?.to && ` (${STAGE_LABEL(h.details.from)} → ${STAGE_LABEL(h.details.to)})`}
                      <span style={{ color: '#CBD5E1' }}> · {new Date(h.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
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
const smallBtnStyle = {
  background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '6px 12px',
  borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer'
}
