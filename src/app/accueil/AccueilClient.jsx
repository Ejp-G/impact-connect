'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Calendar, Trash2 } from '@/lib/icons'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = { date: todayISO(), presents: '', nouveaux_comptes: '', appels_au_salut_comptes: '', compte_rendu: '' }

export default function AccueilClient({ cultes, profile }) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(culte) {
    setEditing(culte)
    setForm({
      date: culte.date,
      presents: culte.presents ?? '',
      nouveaux_comptes: culte.nouveaux_comptes ?? '',
      appels_au_salut_comptes: culte.appels_au_salut_comptes ?? '',
      compte_rendu: culte.compte_rendu || ''
    })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.date) { setError('La date est obligatoire.'); return }
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      date: form.date,
      presents: form.presents === '' ? null : Number(form.presents),
      nouveaux_comptes: form.nouveaux_comptes === '' ? null : Number(form.nouveaux_comptes),
      appels_au_salut_comptes: form.appels_au_salut_comptes === '' ? null : Number(form.appels_au_salut_comptes),
      compte_rendu: form.compte_rendu.trim() || null,
      created_by: session?.user?.id,
      updated_at: new Date().toISOString(),
    }
    const query = editing
      ? supabase.from('cultes').update(payload).eq('id', editing.id)
      : supabase.from('cultes').insert(payload)
    const { error: err } = await query
    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? 'Un culte existe déjà pour cette date. Modifiez-le plutôt.' : err.message)
      return
    }
    setShowForm(false)
    router.refresh()
  }

  async function deleteCulte(culte) {
    if (!confirm(`Supprimer le culte du ${new Date(culte.date).toLocaleDateString('fr-FR')} ? Cette action est irréversible.`)) return
    const { error: err } = await supabase.from('cultes').delete().eq('id', culte.id)
    if (err) { alert(err.message); return }
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: 'var(--gy)' }}>{cultes.length} culte(s) enregistré(s)</div>
        <button onClick={openCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} strokeWidth={2} /> Nouveau culte
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Présents</th><th>Nouveaux</th><th>Appels au salut</th><th>Compte rendu</th><th>Enregistré par</th><th></th></tr>
          </thead>
          <tbody>
            {cultes.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} strokeWidth={2} color="var(--gy)" />
                  {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ fontSize: 13 }}>{c.presents ?? '—'}</td>
                <td style={{ fontSize: 13 }}>{c.nouveaux_comptes ?? '—'}</td>
                <td style={{ fontSize: 13 }}>{c.appels_au_salut_comptes ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gd)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.compte_rendu || '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--gy)' }}>{c.creator?.name || '—'}</td>
                <td>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(c)} style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}>
                      <Pencil size={13} strokeWidth={2} color="#3B82F6" />
                    </button>
                    <button onClick={() => deleteCulte(c)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={13} strokeWidth={2} color="#DC2626" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {cultes.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>Aucun culte enregistré pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editing ? 'Modifier le culte' : 'Nouveau culte'}</div>
              <button onClick={() => setShowForm(false)} style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Date du culte</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} disabled={!!editing} />
            </div>
            <div className="g2">
              <div className="form-group"><label className="form-label">Nombre de présents</label><input type="number" min={0} className="form-input" value={form.presents} onChange={e => setForm({ ...form, presents: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Nouveaux visiteurs comptés</label><input type="number" min={0} className="form-input" value={form.nouveaux_comptes} onChange={e => setForm({ ...form, nouveaux_comptes: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Appels au salut comptés</label><input type="number" min={0} className="form-input" value={form.appels_au_salut_comptes} onChange={e => setForm({ ...form, appels_au_salut_comptes: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Compte rendu du culte</label>
              <textarea className="form-input" rows={4} style={{ resize: 'vertical' }} value={form.compte_rendu} onChange={e => setForm({ ...form, compte_rendu: e.target.value })} placeholder="Résumé, points marquants, difficultés éventuelles..." />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ flex: 1 }}>Annuler</button>
              <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
