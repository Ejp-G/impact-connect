'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NEED_CATEGORIES } from '@/lib/constants'

const STATUS_OPTIONS = [
  ['a_traiter', '🔴 À traiter'], ['en_cours', '🟠 En cours'], ['termine', '🟢 Terminé']
]

// Le tableau des besoins ne stocke rien : il affiche uniquement une vue
// synthetisee de contact_needs. Ce composant permet de voir qui est
// concerne, l'origine du besoin, et de faire avancer l'action associee
// (statut, responsable, note) directement sur la ligne contact_needs.
export default function NeedsDrilldownModal({ categoryId, onClose, profiles = [] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [localEdits, setLocalEdits] = useState({})

  const category = NEED_CATEGORIES.find(c => c.id === categoryId)

  useEffect(() => { if (categoryId) load() }, [categoryId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('contact_needs')
      .select('id,note,status,detected_at,action_note,responsible_id,contact:contacts(id,first_name,last_name,phone),detected_by:profiles!contact_needs_detected_by_fkey(name)')
      .eq('category', categoryId)
      .order('detected_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function edit(needId, field, value) {
    setLocalEdits(prev => ({ ...prev, [needId]: { ...prev[needId], [field]: value } }))
  }

  function valueFor(row, field) {
    return localEdits[row.id]?.[field] !== undefined ? localEdits[row.id][field] : (row[field] ?? '')
  }

  async function saveRow(row) {
    setSavingId(row.id)
    const patch = {
      status: valueFor(row, 'status'),
      responsible_id: valueFor(row, 'responsible_id') || null,
      action_note: valueFor(row, 'action_note') || null,
      resolved_at: valueFor(row, 'status') === 'termine' ? new Date().toISOString() : null
    }
    const { error } = await supabase.from('contact_needs').update(patch).eq('id', row.id)
    setSavingId(null)
    if (error) { alert(error.message); return }
    await load()
    router.refresh()
  }

  if (!categoryId) return null

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 720 }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{category?.emoji} {category?.label || categoryId}</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: 30 }}>Chargement…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: 30 }}>Aucune personne concernée pour le moment.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rows.map(row => (
                <div key={row.id} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{row.contact?.first_name} {row.contact?.last_name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        signalé par {row.detected_by?.name || '—'} le {new Date(row.detected_at).toLocaleDateString('fr-FR')}
                        {row.contact?.phone ? ` · ${row.contact.phone}` : ''}
                      </div>
                    </div>
                  </div>
                  {row.note && <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, fontStyle: 'italic' }}>« {row.note} »</div>}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <select value={valueFor(row, 'status')} onChange={e => edit(row.id, 'status', e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 140 }}>
                      {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={valueFor(row, 'responsible_id')} onChange={e => edit(row.id, 'responsible_id', e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
                      <option value="">— Non attribué —</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <input
                    value={valueFor(row, 'action_note')}
                    onChange={e => edit(row.id, 'action_note', e.target.value)}
                    placeholder="Action prévue / en cours..."
                    style={{ ...inputStyle, marginBottom: 8 }}
                  />
                  <button onClick={() => saveRow(row)} disabled={savingId === row.id} style={smallBtnStyle}>
                    {savingId === row.id ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20
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
const smallBtnStyle = {
  background: 'var(--n)', color: '#fff', border: 'none', padding: '8px 16px',
  borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer'
}
