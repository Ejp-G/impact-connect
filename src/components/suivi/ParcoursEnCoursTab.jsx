'use client'
import { useState, useMemo } from 'react'
import { Trash2 } from '@/lib/icons'

const IMPORTANT_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'email', 'phone', 'address', 'commune', 'integratorWelcome']
const FIELD_LABELS = {
  firstName: 'Prénom', lastName: 'Nom', dateOfBirth: 'Date de naissance', sex: 'Sexe',
  email: 'Email', phone: 'Téléphone', whatsapp: 'WhatsApp', address: 'Adresse',
  commune: 'Commune', quartier: 'Quartier', howFound: 'Comment nous a connu',
  invitedBy: 'Invité par', integratorWelcome: 'Accueilli par', prayerRequest: 'Sujet de prière',
}
function digitsOnly(str) { return (str || '').replace(/\D/g, '') }
function computeProgress(formData) {
  const filled = IMPORTANT_FIELDS.filter(f => {
    const v = formData?.[f]
    return v !== undefined && v !== null && v !== ''
  }).length
  return Math.round((filled / IMPORTANT_FIELDS.length) * 100)
}
function computeStatus(p) {
  if (p.status === 'finalise' || p.contact_id) return { key: 'finalise', label: '🟢 Finalisé', color: '#16A34A' }
  const minutesSince = (Date.now() - new Date(p.last_activity_at).getTime()) / 60000
  if (minutesSince <= 60) return { key: 'non_finalise', label: '🟡 Non finalisé', color: '#CA8A04' }
  return { key: 'interrompu', label: '🟠 Interrompu', color: '#EA580C' }
}

function SummaryPill({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '10px 18px', minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--gy)' }}>{label}</div>
    </div>
  )
}

// Modal de confirmation — motif obligatoire, même exigence que la
// suppression d'une fiche visiteur complète (DeleteVisitorModal).
function DeleteConfirmModal({ count, onConfirm, onCancel, saving, error }) {
  const [reason, setReason] = useState('')
  const reasonOk = reason.trim().length >= 5

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, boxShadow: '0 20px 50px rgba(0,0,0,.25)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Trash2 size={17} strokeWidth={2} color="#DC2626" />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#991B1B' }}>
            Supprimer {count > 1 ? `${count} parcours` : 'ce parcours'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
          Ces pré-inscriptions inachevées seront définitivement supprimées. Aucun contact ni fiche visiteur n'est concerné — action tracée dans le journal (motif conservé).
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
          Motif (obligatoire)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex : fiches de test, doublons du formulaire QR…"
          rows={3}
          style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1.5px solid ${reason && !reasonOk ? '#FCA5A5' : '#E2E8F0'}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
        />
        {error && (
          <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onCancel} className="btn btn-secondary" disabled={saving}>Annuler</button>
          <button onClick={() => onConfirm(reason.trim())} disabled={!reasonOk || saving} style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
            background: reasonOk ? '#DC2626' : '#FCA5A5', color: '#fff',
            cursor: reasonOk && !saving ? 'pointer' : 'not-allowed'
          }}>
            {saving ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ParcoursEnCoursTab({ parcoursList = [] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // NOUVEAU : sélection multiple + suppression
  const [selected, setSelected] = useState(new Set())
  const [deleteTarget, setDeleteTarget] = useState(null) // 'bulk' | id | null
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const enriched = useMemo(() => parcoursList.map(p => ({
    ...p,
    progress: computeProgress(p.form_data),
    statusInfo: computeStatus(p),
  })), [parcoursList])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qDigits = digitsOnly(search)
    return enriched.filter(p => {
      if (statusFilter === 'a_relancer' && !p.to_relaunch) return false
      if (statusFilter !== 'all' && statusFilter !== 'a_relancer' && p.statusInfo.key !== statusFilter) return false
      if (q) {
        const fd = p.form_data || {}
        const name = `${fd.firstName || ''} ${fd.lastName || ''} ${fd.email || ''}`.toLowerCase()
        const phoneMatch = qDigits.length >= 3 && digitsOnly(fd.phone).includes(qDigits)
        if (!name.includes(q) && !phoneMatch) return false
      }
      return true
    })
  }, [enriched, search, statusFilter])

  const summary = useMemo(() => ({
    nonFinalise: enriched.filter(p => p.statusInfo.key === 'non_finalise').length,
    interrompu: enriched.filter(p => p.statusInfo.key === 'interrompu').length,
    aRelancer: enriched.filter(p => p.to_relaunch).length,
  }), [enriched])

  async function toggleRelaunch(p) {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/suivi/parcours/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toRelaunch: !p.to_relaunch })
      })
      if (res.ok) window.location.reload()
    } finally {
      setBusyId(null)
    }
  }

  async function copyResumeLink(p) {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/suivi/parcours/${p.id}/resume-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) return
      const url = `${window.location.origin}/qrcode?resume=${data.token}`
      await navigator.clipboard.writeText(url)
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(null), 2000)
    } finally {
      setBusyId(null)
    }
  }

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)))
  }
  const allSelected = filtered.length > 0 && selected.size === filtered.length

  async function confirmDelete(reason) {
    setDeleting(true)
    setDeleteError(null)
    let res
    if (deleteTarget === 'bulk') {
      res = await fetch('/api/suivi/parcours/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], reason })
      })
    } else {
      res = await fetch(`/api/suivi/parcours/${deleteTarget}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
    }
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) { setDeleteError(data.error || 'Erreur lors de la suppression'); return }
    setDeleteTarget(null)
    setSelected(new Set())
    window.location.reload()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <SummaryPill label="Non finalisés" value={summary.nonFinalise} color="#CA8A04" />
        <SummaryPill label="Interrompus" value={summary.interrompu} color="#EA580C" />
        <SummaryPill label="À relancer" value={summary.aRelancer} color="#DC2626" />

        {selected.size > 0 && (
          <button onClick={() => { setDeleteError(null); setDeleteTarget('bulk') }} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', color: '#DC2626',
            border: '1px solid #FCA5A5', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto'
          }}>
            <Trash2 size={14} strokeWidth={2} /> Supprimer la sélection ({selected.size})
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--br)', borderRadius: 10, padding: '8px 14px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, email, téléphone)..." style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, width: 200 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'Tous'], ['non_finalise', 'Non finalisé'], ['interrompu', 'Interrompu'], ['a_relancer', 'À relancer']].map(([id, label]) => (
            <div key={id} onClick={() => setStatusFilter(id)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: statusFilter === id ? 'var(--n)' : '#F1F5F9', color: statusFilter === id ? '#fff' : '#64748B'
            }}>
              {label}
            </div>
          ))}
        </div>
        {filtered.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gy)', cursor: 'pointer', marginLeft: 'auto' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 14, height: 14 }} />
            Tout sélectionner
          </label>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const fd = p.form_data || {}
          const displayName = `${fd.firstName || '(sans prénom)'} ${fd.lastName || ''}`.trim()
          const isOpen = openId === p.id
          const isChecked = selected.has(p.id)
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px' }}>
                <input type="checkbox" checked={isChecked} onChange={e => toggleSelect(p.id, e)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                <div onClick={() => setOpenId(isOpen ? null : p.id)} style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{displayName}</span>
                    <span style={{ fontSize: 11, color: 'var(--gy)' }}>Progression : <b>{p.progress}%</b></span>
                    <span style={{ fontSize: 11, color: 'var(--gy)' }}>Dernière activité : {new Date(p.last_activity_at).toLocaleString('fr-FR')}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.statusInfo.color }}>{p.statusInfo.label}</span>
                    {p.to_relaunch && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>🔴 À relancer</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--gy)' }}>{isOpen ? '▾' : '▸'}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(p.id) }}
                  title="Supprimer ce parcours"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0, display: 'flex' }}
                >
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
              {isOpen && (
                <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', marginBottom: 6, textTransform: 'uppercase' }}>Informations renseignées</div>
                      {IMPORTANT_FIELDS.filter(f => fd[f]).length === 0 && <div style={{ fontSize: 12, color: 'var(--gy)' }}>Aucune information pour l'instant.</div>}
                      {IMPORTANT_FIELDS.filter(f => fd[f]).map(f => (
                        <div key={f} style={{ fontSize: 12, marginBottom: 4 }}><b>{FIELD_LABELS[f] || f} :</b> {String(fd[f])}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', marginBottom: 6, textTransform: 'uppercase' }}>Champs manquants</div>
                      {IMPORTANT_FIELDS.filter(f => !fd[f]).length === 0 && <div style={{ fontSize: 12, color: '#16A34A' }}>Tout est renseigné.</div>}
                      {IMPORTANT_FIELDS.filter(f => !fd[f]).map(f => (
                        <div key={f} style={{ fontSize: 12, marginBottom: 4, color: '#94A3B8' }}>{FIELD_LABELS[f] || f}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button disabled={busyId === p.id} onClick={() => copyResumeLink(p)} className="btn btn-secondary" style={{ fontSize: 12 }}>
                      {copiedId === p.id ? '✅ Lien copié !' : '🔗 Copier le lien de reprise'}
                    </button>
                    <button disabled={busyId === p.id} onClick={() => toggleRelaunch(p)} className="btn btn-secondary" style={{ fontSize: 12 }}>
                      {p.to_relaunch ? 'Retirer des relances' : 'Marquer à relancer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>Aucun parcours en cours pour le moment.</div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          count={deleteTarget === 'bulk' ? selected.size : 1}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
          saving={deleting}
          error={deleteError}
        />
      )}
    </div>
  )
}
