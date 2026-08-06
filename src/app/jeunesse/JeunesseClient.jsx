'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from '@/lib/icons'

const emptyForm = {
  firstName: '', lastName: '', sex: 'F', dateOfBirth: '', phone: '',
  communeId: '', commune: '',
  parentLastName: '', parentFirstName: '', parentPhone: '', parentEmail: '',
  parentAddress: '', parentRelation: '', authorized: false,
}

export default function JeunesseClient({ mineurs, count, communes }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const statsByStatus = {
    pending: mineurs.filter(m => m.parental_status === 'pending').length,
    authorized: mineurs.filter(m => m.parental_status === 'authorized').length,
    expired: mineurs.filter(m => m.parental_status === 'expired').length,
  }

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.firstName.trim()) { setError('Le prénom est obligatoire.'); return }
    if (!form.dateOfBirth) { setError('La date de naissance est obligatoire pour vérifier la minorité.'); return }
    if (!form.parentLastName.trim() && !form.parentFirstName.trim()) {
      setError('Merci de renseigner au moins le prénom ou le nom du responsable légal.')
      return
    }
    if (!form.parentPhone.trim()) { setError('Le téléphone du responsable légal est obligatoire.'); return }

    setSaving(true)
    setError('')
    const res = await fetch('/api/visitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        sex: form.sex,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone || undefined,
        commune: form.commune, communeId: form.communeId,
        firstVisit: true, salvationCall: false, wantsContact: true, wantsFI: false,
        parentLastName: form.parentLastName.trim() || undefined,
        parentFirstName: form.parentFirstName.trim() || undefined,
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim() || undefined,
        parentAddress: form.parentAddress.trim() || undefined,
        parentRelation: form.parentRelation.trim() || undefined,
      })
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }

    // Autorisation parentale indiquee des la creation, si cochee.
    if (form.authorized && data.data?.id) {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.from('contacts').update({ parental_status: 'authorized' }).eq('id', data.data.id)
    }

    setShowForm(false)
    router.refresh()
  }

  const statusColors = { pending: '#F97316', authorized: '#22C55E', expired: '#EF4444', not_required: '#94A3B8' }
  const statusLabels = { pending: '⏳ En attente', authorized: '✅ Autorisé', expired: '❌ Expiré', not_required: '—' }

  return (
    <div style={{ maxWidth: 1000 }}>
      <style jsx>{`
        .desktop-table { display: block; }
        .mobile-cards { display: none; }
        @media (max-width: 768px) {
          .desktop-table { display: none; }
          .mobile-cards { display: block; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={openAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} strokeWidth={2} /> Ajouter un jeune
        </button>
      </div>

      <div className="g3" style={{ marginBottom: 24 }}>
        {[['👶', 'Total mineurs', count, '#0B3D91'], ['⏳', 'En attente', statsByStatus.pending, '#F97316'], ['✅', 'Autorisés', statsByStatus.authorized, '#22C55E']].map(([ic, l, v, c]) => (
          <div key={l} className="card" style={{ padding: 20, borderTop: `3px solid ${c}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: 13, color: 'var(--gd)', marginBottom: 8 }}>{l}</div><div style={{ fontSize: 32, fontWeight: 800 }}>{v}</div></div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{ic}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15 }}>Dossiers mineurs</div>

        {/* Vue tableau — desktop / tablette */}
        <div className="desktop-table" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Mineur</th><th>Âge</th><th>Sexe</th><th>Parent</th><th>Contact parent</th><th>Statut autorisation</th><th>Étape</th></tr></thead>
            <tbody>
              {mineurs.map(m => {
                const age = m.date_of_birth ? Math.floor((Date.now() - new Date(m.date_of_birth)) / (365.25 * 86400000)) : '?'
                return (
                  <tr key={m.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{m.first_name} {m.last_name || ''}</div><div style={{ fontSize: 11, color: 'var(--gy)' }}>{m.commune || '—'}</div></td>
                    <td style={{ fontWeight: 700, color: 'var(--n)' }}>{age} ans</td>
                    <td style={{ fontSize: 12 }}>{m.sex === 'F' ? 'Fille' : 'Garçon'}</td>
                    <td style={{ fontSize: 12 }}>{m.parent_first_name} {m.parent_last_name}{m.parent_relation ? ` (${m.parent_relation})` : ''}</td>
                    <td style={{ fontSize: 12, color: 'var(--gd)' }}>{m.parent_phone || '—'}</td>
                    <td><span className="badge" style={{ background: `${statusColors[m.parental_status] || '#94A3B8'}20`, color: statusColors[m.parental_status] || '#94A3B8' }}>{statusLabels[m.parental_status] || m.parental_status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--gd)' }}>{m.stage || 'visiteur'}</td>
                  </tr>
                )
              })}
              {mineurs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gy)' }}>Aucun mineur enregistré</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Vue cartes — mobile */}
        <div className="mobile-cards">
          {mineurs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--gy)', fontSize: 13 }}>Aucun mineur enregistré</div>
          )}
          {mineurs.map(m => {
            const age = m.date_of_birth ? Math.floor((Date.now() - new Date(m.date_of_birth)) / (365.25 * 86400000)) : '?'
            return (
              <div key={m.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{m.first_name} {m.last_name || ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--gy)' }}>{m.commune || '—'}</div>
                  </div>
                  <span className="badge" style={{ background: `${statusColors[m.parental_status] || '#94A3B8'}20`, color: statusColors[m.parental_status] || '#94A3B8', whiteSpace: 'nowrap' }}>
                    {statusLabels[m.parental_status] || m.parental_status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--gd)', lineHeight: 1.8 }}>
                  <div>🎂 {age} ans · {m.sex === 'F' ? 'Fille' : 'Garçon'}</div>
                  <div>👤 {m.parent_first_name} {m.parent_last_name}{m.parent_relation ? ` (${m.parent_relation})` : ''}</div>
                  {m.parent_phone && <div>📞 {m.parent_phone}</div>}
                  <div>📍 Étape : {m.stage || 'visiteur'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Ajouter un jeune</div>
              <button onClick={() => setShowForm(false)} style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><X size={16} strokeWidth={2} /></button>
            </div>
            {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            <div className="g2">
              <div className="form-group"><label className="form-label">Prénom *</label><input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div className="form-group">
                <label className="form-label">Nom (facultatif)</label>
                <input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Si connu" />
              </div>
            </div>
            <div className="g2">
              <div className="form-group"><label className="form-label">Date de naissance *</label><input type="date" className="form-input" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Sexe</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['F', 'Fille'], ['M', 'Garçon']].map(([v, l]) => (
                    <div key={v} onClick={() => setForm({ ...form, sex: v })} style={{ flex: 1, padding: 10, borderRadius: 10, border: `2px solid ${form.sex === v ? 'var(--n)' : 'var(--br)'}`, background: form.sex === v ? 'rgba(11,61,145,.08)' : '#fff', textAlign: 'center', fontSize: 13, fontWeight: 600, color: form.sex === v ? 'var(--n)' : '#64748B', cursor: 'pointer' }}>{l}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Téléphone (facultatif)</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Commune</label>
              <select className="form-input" value={form.communeId} onChange={e => { const opt = e.target.options[e.target.selectedIndex]; setForm({ ...form, communeId: e.target.value, commune: opt.text }) }}>
                <option value="">Sélectionner...</option>
                {communes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 10 }}>Responsable légal</div>
              <div className="g2">
                <div className="form-group"><label className="form-label">Prénom du parent</label><input className="form-input" value={form.parentFirstName} onChange={e => setForm({ ...form, parentFirstName: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Nom du parent (facultatif)</label><input className="form-input" value={form.parentLastName} onChange={e => setForm({ ...form, parentLastName: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Téléphone du parent *</label><input className="form-input" value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} /></div>
              <div className="g2">
                <div className="form-group"><label className="form-label">Email du parent</label><input type="email" className="form-input" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Lien de parenté</label><input className="form-input" value={form.parentRelation} onChange={e => setForm({ ...form, parentRelation: e.target.value })} placeholder="Mère, père, tuteur..." /></div>
              </div>
              <div className="form-group"><label className="form-label">Adresse (si nécessaire)</label><input className="form-input" value={form.parentAddress} onChange={e => setForm({ ...form, parentAddress: e.target.value })} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
                <input type="checkbox" checked={form.authorized} onChange={e => setForm({ ...form, authorized: e.target.checked })} style={{ width: 16, height: 16 }} />
                Autorisation parentale déjà obtenue
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ flex: 1 }}>Annuler</button>
              <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
