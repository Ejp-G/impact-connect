'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES, NEED_IS_SENSITIVE } from '@/lib/constants'

const METHODS = [
  ['telephone', '📞 Téléphone'], ['whatsapp', '💬 WhatsApp'], ['sms', '✉️ SMS'],
  ['visite', '🚶 Visite'], ['rencontre_culte', '⛪ Rencontre après le culte']
]
const RESULTS = [
  ['repondu', 'A répondu'], ['messagerie', 'Messagerie'],
  ['pas_de_reponse', 'Pas de réponse'], ['numero_invalide', 'Numéro invalide']
]

// Interface de travail quotidien des integrateurs. Ne modifie JAMAIS
// directement la fiche visiteur : ecrit uniquement dans
// integrator_reports et contact_needs. La fiche visiteur reste la
// base de donnees, ce panneau est l'espace de saisie.
export default function NewcomerReportPanel({ contactId, onClose, onOpenFullProfile, currentProfile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [contact, setContact] = useState(null)
  const [integratorPair, setIntegratorPair] = useState([])
  const [reports, setReports] = useState([])
  const [needsHistory, setNeedsHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    method: 'telephone', result: 'repondu', duration_minutes: '',
    notes: '', next_action: '', next_contact_date: ''
  })
  const [checkedNeeds, setCheckedNeeds] = useState({}) // { category: noteText }

  useEffect(() => { if (contactId) load() }, [contactId])

  async function load() {
    setLoading(true)
    const { data: c } = await supabase.from('contacts')
      .select('id,first_name,last_name,sex,phone,whatsapp,commune,stage,fi:familles_impact(name),welcomed_by:profiles!contacts_welcomed_by_fkey(name)')
      .eq('id', contactId).single()
    setContact(c)

    const { data: pairData } = await supabase.from('contact_integrators')
      .select('position, integrator:profiles(id,name)')
      .eq('contact_id', contactId).order('position')
    setIntegratorPair(pairData || [])

    const { data: reportRows } = await supabase.from('integrator_reports')
      .select('id,contacted_at,method,result,duration_minutes,notes,next_action,next_contact_date,integrator:profiles(name)')
      .eq('contact_id', contactId)
      .order('contacted_at', { ascending: false })
    setReports(reportRows || [])

    const { data: needRows } = await supabase.from('contact_needs')
      .select('id,category,domain,note,status,detected_at,detected_by:profiles(name)')
      .eq('contact_id', contactId)
      .order('detected_at', { ascending: false })
    setNeedsHistory(needRows || [])

    setLoading(false)
  }

  function toggleNeed(categoryId) {
    setCheckedNeeds(prev => {
      const next = { ...prev }
      if (categoryId in next) delete next[categoryId]
      else next[categoryId] = ''
      return next
    })
  }

  function setNeedNote(categoryId, text) {
    setCheckedNeeds(prev => ({ ...prev, [categoryId]: text }))
  }

  async function submitReport() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSaving(true)

    const { error } = await supabase.from('integrator_reports').insert({
      contact_id: contactId,
      integrator_id: session.user.id,
      method: form.method,
      result: form.result,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      notes: form.notes.trim() || null,
      next_action: form.next_action.trim() || null,
      next_contact_date: form.next_contact_date || null
    })

    if (!error) {
      await supabase.from('contacts').update({ integrator_contacted: true }).eq('id', contactId)

      const needEntries = Object.entries(checkedNeeds)
      if (needEntries.length) {
        const rows = needEntries.map(([categoryId, note]) => {
          const cat = NEED_CATEGORIES.find(n => n.id === categoryId)
          return {
            contact_id: contactId,
            category: categoryId,
            domain: cat?.domain || 'personnel',
            sensitive: NEED_IS_SENSITIVE(categoryId),
            note: note?.trim() || null,
            detected_by: session.user.id
          }
        })
        await supabase.from('contact_needs').insert(rows)
      }
    }

    setSaving(false)
    if (error) { alert(error.message); return }

    setForm({ method: 'telephone', result: 'repondu', duration_minutes: '', notes: '', next_action: '', next_contact_date: '' })
    setCheckedNeeds({})
    await load()
    router.refresh()
  }

  if (!contactId) return null

  const spiritualNeeds = NEED_CATEGORIES.filter(n => n.domain === 'spirituel')
  const personalNeeds = NEED_CATEGORIES.filter(n => n.domain === 'personnel')
  const isAdmin = currentProfile?.role === 'admin'

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 720 }}>
        {loading || !contact ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{contact.first_name} {contact.last_name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>
                  {contact.commune || '—'} · {contact.phone || contact.whatsapp || '—'} · {STAGE_LABEL(contact.stage)}
                </div>
              </div>
              <button onClick={onClose} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Contexte en lecture seule */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <InfoLine label="Intégrateurs" value={integratorPair.map(p => p.integrator?.name).filter(Boolean).join(' & ') || '—'} />
                <InfoLine label="FIJ" value={contact.fi?.name || 'Non attribuée'} />
                <InfoLine label="Accueilli par" value={contact.welcomed_by?.name || '—'} />
                {isAdmin && onOpenFullProfile && (
                  <button onClick={() => onOpenFullProfile(contactId)} style={{ ...smallBtnStyle, marginLeft: 'auto' }}>
                    Voir la fiche complète (admin)
                  </button>
                )}
              </div>

              {/* Formulaire de compte-rendu */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📝 Nouveau compte-rendu</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                    {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                    {RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" min={0} placeholder="Durée (min)" value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                </div>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Compte rendu (ex: allait bien, travaille de nuit, viendra dimanche...)"
                  style={{ ...inputStyle, minHeight: 60 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })}
                    placeholder="Prochaine action prévue" style={{ ...inputStyle, flex: 1 }} />
                  <input type="date" value={form.next_contact_date}
                    onChange={e => setForm({ ...form, next_contact_date: e.target.value })} style={{ ...inputStyle, width: 160 }} />
                </div>

                {/* Decouverte progressive des besoins */}
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                    Besoins constatés lors de cet échange (optionnel)
                  </div>

                  <NeedGroup title="🙏 Vie spirituelle" items={spiritualNeeds} checked={checkedNeeds} onToggle={toggleNeed} onNote={setNeedNote} />
                  <NeedGroup title="❤️ Vie personnelle" items={personalNeeds} checked={checkedNeeds} onToggle={toggleNeed} onNote={setNeedNote} />
                </div>

                <button onClick={submitReport} disabled={saving} style={{ ...primaryBtnStyle, marginTop: 8 }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer le compte-rendu'}
                </button>
              </div>

              {/* Historique des comptes-rendus */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique des échanges</div>
              {reports.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Aucun compte-rendu pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {reports.map(r => (
                    <div key={r.id} style={{ fontSize: 12, background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                      <b>{r.integrator?.name || '—'}</b> · {METHODS.find(m => m[0] === r.method)?.[1] || r.method} · {RESULTS.find(m => m[0] === r.result)?.[1] || r.result}
                      {r.duration_minutes ? ` · ${r.duration_minutes} min` : ''}
                      <span style={{ color: '#94A3B8' }}> · {new Date(r.contacted_at).toLocaleString('fr-FR')}</span>
                      {r.notes && <div style={{ color: '#475569', marginTop: 4 }}>{r.notes}</div>}
                      {r.next_action && <div style={{ color: '#0B3D91', marginTop: 2, fontWeight: 600 }}>→ {r.next_action}{r.next_contact_date ? ` (${r.next_contact_date})` : ''}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Historique des besoins detectes */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Besoins détectés</div>
              {needsHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Aucun besoin détecté pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {needsHistory.map(n => (
                    <div key={n.id} style={{ fontSize: 12, background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                      {NEED_CATEGORIES.find(c => c.id === n.category)?.emoji} <b>{NEED_CATEGORIES.find(c => c.id === n.category)?.label || n.category}</b>
                      <span style={{ color: '#94A3B8' }}> · signalé par {n.detected_by?.name || '—'} le {new Date(n.detected_at).toLocaleDateString('fr-FR')}</span>
                      {n.note && <div style={{ color: '#475569', marginTop: 4 }}>{n.note}</div>}
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

function NeedGroup({ title, items, checked, onToggle, onNote }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => {
          const isChecked = item.id in checked
          return (
            <div key={item.id} style={{ width: isChecked ? '100%' : 'auto' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                background: isChecked ? (item.sensitive ? '#FEF2F2' : '#EFF6FF') : '#F8FAFC',
                border: `1px solid ${isChecked ? (item.sensitive ? '#FCA5A5' : '#93C5FD') : '#E2E8F0'}`
              }}>
                <input type="checkbox" checked={isChecked} onChange={() => onToggle(item.id)} style={{ width: 14, height: 14 }} />
                {item.emoji} {item.label}
              </label>
              {isChecked && (
                <input
                  value={checked[item.id]}
                  onChange={e => onNote(item.id, e.target.value)}
                  placeholder="Note (optionnel)"
                  style={{ ...inputStyle, marginTop: 4, fontSize: 12 }}
                />
              )}
            </div>
          )
        })}
      </div>
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
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer'
}
const smallBtnStyle = {
  background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '6px 12px',
  borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer'
}
