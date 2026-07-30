'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X, Clock } from '@/lib/icons'

const ACTION_LABELS = { delete_fi: 'Suppression d\'une Famille d\'Impact' }

export default function ValidationsClient({ requests }) {
  const router = useRouter()
  const [processing, setProcessing] = useState(null)

  const pending = requests.filter(r => r.status === 'pending')
  const treated = requests.filter(r => r.status !== 'pending')

  async function decide(id, decision) {
    setProcessing(id)
    const res = await fetch('/api/change-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision })
    })
    const data = await res.json()
    setProcessing(null)
    if (!res.ok) { alert(data.error); return }
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>En attente ({pending.length})</div>
      {pending.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--gy)', marginBottom: 24 }}>Aucune demande en attente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {pending.map(r => (
            <div key={r.id} className="card" style={{ borderLeft: '4px solid #F97316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ACTION_LABELS[r.action_type] || r.action_type}</div>
                  <div style={{ fontSize: 12, color: 'var(--gy)', marginTop: 4 }}>
                    Demandé par <b>{r.requester?.name || '—'}</b> le {new Date(r.created_at).toLocaleString('fr-FR')}
                  </div>
                  {r.reason && <div style={{ fontSize: 12, color: 'var(--gd)', marginTop: 6, fontStyle: 'italic' }}>« {r.reason} »</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => decide(r.id, 'rejected')} disabled={processing === r.id} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <X size={13} strokeWidth={2} /> Refuser
                  </button>
                  <button onClick={() => decide(r.id, 'approved')} disabled={processing === r.id} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} strokeWidth={2} /> Accepter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={14} strokeWidth={2} /> Historique ({treated.length})
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Action</th><th>Demandeur</th><th>Décision</th><th>Traité par</th><th>Date</th></tr></thead>
          <tbody>
            {treated.map(r => (
              <tr key={r.id}>
                <td style={{ fontSize: 13 }}>{ACTION_LABELS[r.action_type] || r.action_type}</td>
                <td style={{ fontSize: 12 }}>{r.requester?.name || '—'}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: r.status === 'approved' ? '#16A34A' : '#DC2626', background: r.status === 'approved' ? '#F0FDF4' : '#FEF2F2' }}>
                    {r.status === 'approved' ? 'Acceptée' : 'Refusée'}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{r.reviewer?.name || '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--gy)' }}>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            ))}
            {treated.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--gy)' }}>Aucun historique pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
