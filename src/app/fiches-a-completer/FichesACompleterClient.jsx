'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from '@/lib/icons'

const STATUS_LABELS = { incomplete: { label: 'Incomplet', color: '#DC2626', bg: '#FEF2F2' }, duplicate: { label: 'Doublon', color: '#D97706', bg: '#FFFBEB' } }

export default function FichesACompleterClient({ rows: initialRows }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [committing, setCommitting] = useState(null)
  const [message, setMessage] = useState('')

  const byBatch = useMemo(() => {
    const map = {}
    rows.forEach(r => { (map[r.batch_id] = map[r.batch_id] || { batch: r.batch, rows: [] }).rows.push(r) })
    return Object.entries(map)
  }, [rows])

  function startEdit(row) {
    setEditingId(row.id)
    setEditValues(row.mapped_data || {})
  }

  async function saveEdit(row) {
    const hasName = editValues.nom && editValues.prenom
    const hasContact = editValues.telephone || editValues.email
    const newStatus = hasName && hasContact ? 'valid' : 'incomplete'
    const res = await fetch(`/api/import/${row.batch_id}/rows`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: row.id, mapped_data: editValues, status: newStatus })
    })
    if (res.ok) {
      setEditingId(null)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, mapped_data: editValues, status: newStatus } : r))
    }
  }

  async function commitBatch(batchId) {
    setCommitting(batchId)
    setMessage('')
    const res = await fetch(`/api/import/${batchId}/commit`, { method: 'POST' })
    const data = await res.json()
    setCommitting(null)
    if (!res.ok) { setMessage(`Erreur : ${data.error}`); return }
    setMessage(`${data.imported} fiche(s) corrigée(s) importée(s) avec succès.`)
    router.refresh()
    // Retire de la liste les lignes de ce lot qui viennent d'etre corrigees en 'valid'
    setRows(prev => prev.filter(r => !(r.batch_id === batchId && r.status === 'valid')))
  }

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>
        Aucune fiche à compléter pour le moment. 🎉
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ fontSize: 14, color: 'var(--gy)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={15} strokeWidth={2} color="#DC2626" />
        {rows.length} fiche(s) à corriger avant import, réparties sur {byBatch.length} lot(s)
      </div>

      {message && <div style={{ background: message.startsWith('Erreur') ? '#FEF2F2' : '#F0FDF4', color: message.startsWith('Erreur') ? '#DC2626' : '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{message}</div>}

      {byBatch.map(([batchId, { batch, rows: batchRows }]) => {
        const readyCount = batchRows.filter(r => r.status === 'valid').length
        return (
          <div key={batchId} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{batch?.file_name || 'Lot supprimé'}</div>
              <button onClick={() => commitBatch(batchId)} disabled={committing === batchId || readyCount === 0} className="btn btn-primary">
                {committing === batchId ? 'Import…' : `Importer les lignes corrigées (${readyCount})`}
              </button>
            </div>
            <table>
              <thead><tr><th>Statut</th><th>Nom / Prénom</th><th>Contact</th><th>Commune</th><th>Motif</th><th></th></tr></thead>
              <tbody>
                {batchRows.map(row => {
                  const s = STATUS_LABELS[row.status] || STATUS_LABELS.incomplete
                  const isEditing = editingId === row.id
                  const d = isEditing ? editValues : row.mapped_data
                  return (
                    <tr key={row.id}>
                      <td><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>{row.status === 'valid' ? 'Corrigé ✓' : s.label}</span></td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input style={editInputStyle} value={d.prenom || ''} placeholder="Prénom" onChange={e => setEditValues({ ...editValues, prenom: e.target.value })} />
                            <input style={editInputStyle} value={d.nom || ''} placeholder="Nom" onChange={e => setEditValues({ ...editValues, nom: e.target.value })} />
                          </div>
                        ) : <>{d.prenom} {d.nom}</>}
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input style={editInputStyle} value={d.telephone || ''} placeholder="Téléphone" onChange={e => setEditValues({ ...editValues, telephone: e.target.value })} />
                            <input style={editInputStyle} value={d.email || ''} placeholder="Email" onChange={e => setEditValues({ ...editValues, email: e.target.value })} />
                          </div>
                        ) : <>{d.telephone}<br />{d.email}</>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {isEditing ? <input style={editInputStyle} value={d.commune || ''} onChange={e => setEditValues({ ...editValues, commune: e.target.value })} /> : d.commune}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--gy)' }}>{row.status_reason}</td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveEdit(row)} style={smallBtnStyle}>Enregistrer</button>
                            <button onClick={() => setEditingId(null)} style={smallBtnStyle}>Annuler</button>
                          </div>
                        ) : row.status !== 'valid' && <button onClick={() => startEdit(row)} style={smallBtnStyle}>Corriger</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const editInputStyle = { width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d0d5dd', borderRadius: 4 }
const smallBtnStyle = { fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer' }
