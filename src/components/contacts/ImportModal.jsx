'use client'
import { useState, useCallback } from 'react'

const STATUS_LABELS = {
  valid: { label: 'Valide', color: '#16a34a', bg: '#f0fdf4' },
  duplicate: { label: 'Doublon', color: '#b45309', bg: '#fffbeb' },
  incomplete: { label: 'Incomplet', color: '#b91c1c', bg: '#fef2f2' },
  excluded: { label: 'Déjà importé', color: '#667085', bg: '#f9fafb' },
}

const FIELD_LABELS = {
  statut: 'Statut', sujet_priere: 'Sujet de prière', star_referent: 'STAR référent',
}

export default function ImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload') // upload | preview
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [batchId, setBatchId] = useState(null)
  const [batch, setBatch] = useState(null)
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [editingRowId, setEditingRowId] = useState(null)
  const [editValues, setEditValues] = useState({})

  const loadRows = useCallback(async (id) => {
    setLoadingRows(true)
    const res = await fetch(`/api/import/${id}/rows`)
    const data = await res.json()
    setBatch(data.batch)
    setRows(data.rows || [])
    setLoadingRows(false)
    if (data.batch?.status === 'processing') {
      setTimeout(() => loadRows(id), 3000)
    }
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/import/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Erreur upload')
      const id = uploadData.batch.id
      const processRes = await fetch(`/api/import/${id}/process`, { method: 'POST' })
      const processData = await processRes.json()
      if (!processRes.ok) throw new Error(processData.error || 'Erreur de traitement')
      setBatchId(id)
      setStep('preview')
      loadRows(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row) {
    setEditingRowId(row.id)
    setEditValues(row.mapped_data || {})
  }

  async function saveEdit(row) {
    const hasName = editValues.nom && editValues.prenom
    const hasContact = editValues.telephone || editValues.email
    const newStatus = hasName && hasContact ? 'valid' : 'incomplete'
    const res = await fetch(`/api/import/${batchId}/rows`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: row.id, mapped_data: editValues, status: newStatus })
    })
    if (res.ok) { setEditingRowId(null); loadRows(batchId) }
  }

  async function handleCommit() {
    setCommitting(true)
    setMessage(null)
    const res = await fetch(`/api/import/${batchId}/commit`, { method: 'POST' })
    const data = await res.json()
    setCommitting(false)
    if (res.ok) {
      setMessage(`${data.imported} visiteur(s) importé(s) avec succès.`)
      loadRows(batchId)
      onImported?.()
    } else {
      setMessage(`Erreur : ${data.error}`)
    }
  }

  const validCount = rows.filter(r => r.status === 'valid').length

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, maxWidth: step === 'preview' ? 1000 : 520 }}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📥 Import intelligent de visiteurs</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {step === 'upload' && (
            <form onSubmit={handleUpload}>
              <p style={{ color: '#667085', marginBottom: 20, fontSize: 13 }}>Excel (.xlsx), CSV ou PDF — l'analyse est automatique.</p>
              {error && <div style={errorStyle}>{error}</div>}
              <div style={dropzoneStyle}>
                <div style={{ marginBottom: 12 }}>Glissez un fichier ou sélectionnez-en un</div>
                <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={e => setFile(e.target.files[0])} />
              </div>
              <button type="submit" disabled={!file || loading} style={{ ...primaryBtnStyle, width: '100%' }}>
                {loading ? 'Analyse en cours…' : 'Importer et analyser'}
              </button>
            </form>
          )}

          {step === 'preview' && (
            <div>
              {batch?.status === 'processing' ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Analyse du fichier en cours…</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{batch?.file_name}</div>
                      <div style={{ fontSize: 12, color: '#667085' }}>{rows.length} ligne(s) détectée(s)</div>
                    </div>
                    <button onClick={handleCommit} disabled={committing || validCount === 0} style={primaryBtnStyle}>
                      {committing ? 'Import en cours…' : `Valider et importer (${validCount})`}
                    </button>
                  </div>

                  {message && <div style={successStyle}>{message}</div>}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_LABELS).map(([key, { label, color, bg }]) => {
                      const count = rows.filter(r => r.status === key).length
                      if (count === 0) return null
                      return <span key={key} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: bg }}>{label} : {count}</span>
                    })}
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Statut', 'Nom / Prénom', 'Contact', 'Commune', 'Détails', 'Note', ''].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const s = STATUS_LABELS[row.status] || STATUS_LABELS.incomplete
                          const isEditing = editingRowId === row.id
                          const d = isEditing ? editValues : row.mapped_data
                          return (
                            <tr key={row.id}>
                              <td style={tdStyle}><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span></td>
                              <td style={tdStyle}>
                                {isEditing ? (
                                  <>
                                    <input style={editInputStyle} value={d.nom || ''} placeholder="Nom" onChange={e => setEditValues({ ...editValues, nom: e.target.value })} />
                                    <input style={editInputStyle} value={d.prenom || ''} placeholder="Prénom" onChange={e => setEditValues({ ...editValues, prenom: e.target.value })} />
                                  </>
                                ) : <>{d.prenom} {d.nom}</>}
                              </td>
                              <td style={tdStyle}>
                                {isEditing ? (
                                  <>
                                    <input style={editInputStyle} value={d.telephone || ''} placeholder="Téléphone" onChange={e => setEditValues({ ...editValues, telephone: e.target.value })} />
                                    <input style={editInputStyle} value={d.email || ''} placeholder="Email" onChange={e => setEditValues({ ...editValues, email: e.target.value })} />
                                  </>
                                ) : <>{d.telephone}<br />{d.email}</>}
                              </td>
                              <td style={tdStyle}>
                                {isEditing ? <input style={editInputStyle} value={d.commune || ''} onChange={e => setEditValues({ ...editValues, commune: e.target.value })} /> : d.commune}
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11, color: '#667085' }}>
                                {d.statut && <div>{FIELD_LABELS.statut}: {d.statut}</div>}
                                {d.sujet_priere && <div>{FIELD_LABELS.sujet_priere}: {d.sujet_priere}</div>}
                                {d.star_referent && <div>{FIELD_LABELS.star_referent}: {d.star_referent}</div>}
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11, color: '#667085' }}>{row.status_reason}</td>
                              <td style={tdStyle}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => saveEdit(row)} style={smallBtnStyle}>Enregistrer</button>
                                    <button onClick={() => setEditingRowId(null)} style={smallBtnStyle}>Annuler</button>
                                  </div>
                                ) : <button onClick={() => startEdit(row)} style={smallBtnStyle}>Corriger</button>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }
const headerStyle = { padding: '18px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'sticky', top: 0, zIndex: 1 }
const closeBtnStyle = { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14 }
const dropzoneStyle = { border: '2px dashed #d0d5dd', borderRadius: 10, padding: 32, textAlign: 'center', marginBottom: 20 }
const primaryBtnStyle = { padding: '10px 20px', background: 'var(--n)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const errorStyle = { background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }
const successStyle = { background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }
const thStyle = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#667085', padding: '8px 10px', background: '#f9fafb' }
const tdStyle = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #eee' }
const editInputStyle = { width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d0d5dd', borderRadius: 4, marginBottom: 3 }
const smallBtnStyle = { fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer' }
