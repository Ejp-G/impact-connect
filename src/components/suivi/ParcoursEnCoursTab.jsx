'use client'
import { useState, useMemo } from 'react'

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

export default function ParcoursEnCoursTab({ parcoursList = [] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

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

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <SummaryPill label="Non finalisés" value={summary.nonFinalise} color="#CA8A04" />
        <SummaryPill label="Interrompus" value={summary.interrompu} color="#EA580C" />
        <SummaryPill label="À relancer" value={summary.aRelancer} color="#DC2626" />
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const fd = p.form_data || {}
          const displayName = `${fd.firstName || '(sans prénom)'} ${fd.lastName || ''}`.trim()
          const isOpen = openId === p.id
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setOpenId(isOpen ? null : p.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{displayName}</span>
                  <span style={{ fontSize: 11, color: 'var(--gy)' }}>Progression : <b>{p.progress}%</b></span>
                  <span style={{ fontSize: 11, color: 'var(--gy)' }}>Dernière activité : {new Date(p.last_activity_at).toLocaleString('fr-FR')}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.statusInfo.color }}>{p.statusInfo.label}</span>
                  {p.to_relaunch && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>🔴 À relancer</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--gy)' }}>{isOpen ? '▾' : '▸'}</span>
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
    </div>
  )
}

function SummaryPill({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--br)', borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--gy)', fontWeight: 600 }}>{label}</div>
    </div>
  )
}
