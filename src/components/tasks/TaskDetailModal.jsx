'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRIORITIES = [
  { value: 'urgent', label: '🔴 Urgent', color: '#EF4444' },
  { value: 'high', label: '🟠 Prioritaire', color: '#F97316' },
  { value: 'normal', label: '🟢 Normal', color: '#22C55E' }
]

export default function TaskDetailModal({ taskId, onClose, profiles = [] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => { if (taskId) load() }, [taskId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tasks')
      .select('*, contact:contacts(id,first_name,last_name,sex,commune,phone), assignee:profiles!tasks_assigned_to_fkey(id,name)')
      .eq('id', taskId).single()
    setTask(data)
    setLoading(false)

    const { data: auditRows } = await supabase.from('audit_log')
      .select('id,action,details,created_at,performed_by')
      .eq('entity_type', 'task').eq('entity_id', taskId)
      .order('created_at', { ascending: false }).limit(15)
    const ids = [...new Set((auditRows || []).map(r => r.performed_by).filter(Boolean))]
    let names = {}
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,name').in('id', ids)
      names = Object.fromEntries((profs || []).map(p => [p.id, p.name]))
    }
    setHistory((auditRows || []).map(r => ({ ...r, authorName: names[r.performed_by] || '—' })))
  }

  async function update(fields, actionLabel) {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('tasks').update(fields).eq('id', taskId)
    if (!error) {
      await supabase.from('audit_log').insert({
        action: actionLabel, entity_type: 'task', entity_id: taskId,
        performed_by: session?.user?.id, details: fields
      })
    }
    setSaving(false)
    if (error) { alert(error.message); return }
    await load()
    router.refresh()
  }

  async function markDone() {
    const { data: { session } } = await supabase.auth.getSession()
    await update({ status: 'done', done_at: new Date().toISOString(), done_by: session?.user?.id }, 'Tâche terminée')
    onClose()
  }

  async function postpone(days) {
    const d = new Date(task.due_date || new Date())
    d.setDate(d.getDate() + days)
    await update({ due_date: d.toISOString().slice(0, 10) }, `Échéance reportée de ${days}j`)
  }

  async function changeDueDate(value) {
    await update({ due_date: value }, 'Échéance modifiée')
  }

  async function changePriority(value) {
    await update({ priority: value }, 'Priorité modifiée')
  }

  async function reassign(value) {
    await update({ assigned_to: value || null }, 'Tâche réassignée')
  }

  async function addNote() {
    if (!newNote.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', session?.user?.id).single()
    const stamp = `[${new Date().toLocaleString('fr-FR')} — ${prof?.name || '—'}] ${newNote.trim()}`
    const updatedNote = task.note ? `${task.note}\n${stamp}` : stamp
    setNewNote('')
    await update({ note: updatedNote }, 'Note ajoutée')
  }

  async function deleteTask() {
    if (!confirm('Supprimer définitivement cette tâche ?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) { alert(error.message); return }
    onClose()
    router.refresh()
  }

  if (!taskId) return null

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 560 }}>
        {loading || !task ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            <div style={headerStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{task.type} — {task.contact?.first_name} {task.contact?.last_name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>{task.status === 'done' ? '✅ Terminée' : '⏳ En attente'}{task.auto_created ? ' · Automatique' : ' · Manuelle'}</div>
              </div>
              <button onClick={onClose} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {task.status !== 'done' && (
                <button onClick={markDone} disabled={saving} style={{ ...primaryBtnStyle, width: '100%', marginBottom: 18, background: '#16A34A' }}>
                  ✅ Marquer comme terminée
                </button>
              )}

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
                <InfoLine label="Visiteur concerné" value={`${task.contact?.first_name || ''} ${task.contact?.last_name || ''}`.trim() || '—'} />
                <InfoLine label="Commune" value={task.contact?.commune || '—'} />
                <InfoLine label="Téléphone" value={task.contact?.phone || '—'} />
                <InfoLine label="Créée le" value={new Date(task.created_at).toLocaleDateString('fr-FR')} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <Field label="Échéance" style={{ flex: 1 }}>
                  <input type="date" value={task.due_date || ''} onChange={e => changeDueDate(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Report rapide" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => postpone(1)} style={smallBtnStyle}>+1j</button>
                    <button onClick={() => postpone(7)} style={smallBtnStyle}>+7j</button>
                  </div>
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <Field label="Priorité" style={{ flex: 1 }}>
                  <select value={task.priority} onChange={e => changePriority(e.target.value)} style={inputStyle}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Responsable" style={{ flex: 1 }}>
                  <select value={task.assigned_to || ''} onChange={e => reassign(e.target.value)} style={inputStyle}>
                    <option value="">— Non assigné —</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Remarques</div>
                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, fontSize: 12, color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 10, maxHeight: 140, overflowY: 'auto' }}>
                  {task.note || 'Aucune remarque.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Ajouter une note…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addNote} style={primaryBtnStyle}>Ajouter</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                <button onClick={deleteTask} style={{ ...smallBtnStyle, color: '#DC2626' }}>Supprimer la tâche</button>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Aucune action enregistrée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ fontSize: 11, color: '#64748B' }}>
                      <b>{h.authorName}</b> — {h.action}
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

function InfoLine({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{value}</div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }
const headerStyle = { padding: '18px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'sticky', top: 0, zIndex: 1 }
const closeBtnStyle = { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14 }
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const primaryBtnStyle = { background: 'var(--n)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const smallBtnStyle = { background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer' }
