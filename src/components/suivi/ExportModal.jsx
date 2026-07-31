'use client'
import { useState } from 'react'
import { X, Download } from '@/lib/icons'

const QUICK_FILTERS = [
  ['nouveaux', 'Nouveaux'], ['appels_salut', 'Appels au salut'], ['reconciliations', 'Réconciliations'],
  ['urgences', 'Urgences'], ['sans_fi', 'Sans FI'], ['sans_integrateur', 'Sans intégrateur'],
]

export default function ExportModal({ onClose, fis = [], communes = [], suiviTeam = [], canViewTeam }) {
  const [scope, setScope] = useState('mine')
  const [integratorId, setIntegratorId] = useState('')
  const [fiId, setFiId] = useState('')
  const [commune, setCommune] = useState('')
  const [period, setPeriod] = useState('all')
  const [sundayDate, setSundayDate] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [quick, setQuick] = useState({})
  const [includeHistory, setIncludeHistory] = useState(false)
  const [loading, setLoading] = useState(null)

  function toggleQuick(key) {
    setQuick(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function runExport(format) {
    setLoading(format)
    try {
      const res = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, scope, integratorId, fiId, commune, period, sundayDate, dateFrom, dateTo, quick, includeHistory })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Échec de l'export.")
        setLoading(null)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const ext = format === 'xlsx' ? 'xlsx' : 'pdf'
      const link = document.createElement('a')
      link.href = url
      link.download = `suivi_prodiges_connect.${ext}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert("Échec de l'export.")
    }
    setLoading(null)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Exporter la liste de suivi</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><X size={16} strokeWidth={2} /></button>
        </div>

        <div className="form-group"><label className="form-label">Périmètre</label>
          <select value={scope} onChange={e => setScope(e.target.value)} className="form-input">
            <option value="mine">Mes visiteurs</option>
            {canViewTeam && <option value="all">Tous les visiteurs</option>}
            {canViewTeam && <option value="integrator">Un intégrateur précis</option>}
          </select>
        </div>
        {scope === 'integrator' && (
          <div className="form-group"><label className="form-label">Intégrateur</label>
            <select value={integratorId} onChange={e => setIntegratorId(e.target.value)} className="form-input">
              <option value="">Sélectionner...</option>
              {suiviTeam.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div className="g2">
          <div className="form-group"><label className="form-label">Famille d'Impact</label>
            <select value={fiId} onChange={e => setFiId(e.target.value)} className="form-input">
              <option value="">Toutes</option>
              {fis.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Commune</label>
            <select value={commune} onChange={e => setCommune(e.target.value)} className="form-input">
              <option value="">Toutes</option>
              {communes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group"><label className="form-label">Période</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="form-input">
            <option value="all">Toutes les périodes</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
            <option value="sunday">Un dimanche précis</option>
            <option value="range">Plage personnalisée</option>
          </select>
        </div>
        {period === 'sunday' && (
          <div className="form-group"><input type="date" value={sundayDate} onChange={e => setSundayDate(e.target.value)} className="form-input" /></div>
        )}
        {period === 'range' && (
          <div className="g2">
            <div className="form-group"><label className="form-label">Du</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input" /></div>
            <div className="form-group"><label className="form-label">Au</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input" /></div>
          </div>
        )}

        <div className="form-group"><label className="form-label">Filtres rapides (cumulables)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_FILTERS.map(([key, label]) => (
              <div key={key} onClick={() => toggleQuick(key)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: quick[key] ? 'var(--n)' : '#F1F5F9', color: quick[key] ? '#fff' : 'var(--gd)' }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={includeHistory} onChange={e => setIncludeHistory(e.target.checked)} style={{ width: 16, height: 16 }} />
          Inclure une feuille "Historique complet" des échanges (Excel uniquement)
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => runExport('xlsx')} disabled={loading} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Download size={14} strokeWidth={2} /> {loading === 'xlsx' ? 'Génération…' : 'Excel (.xlsx)'}
          </button>
          <button onClick={() => runExport('pdf')} disabled={loading} className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Download size={14} strokeWidth={2} /> {loading === 'pdf' ? 'Génération…' : 'PDF imprimable'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gy)', marginTop: 12, lineHeight: 1.5 }}>
          Pour Google Sheets : téléchargez l'Excel, puis dans Google Sheets → Fichier → Importer → Téléverser. Couleurs, filtres et figeage sont conservés.
        </div>
      </div>
    </div>
  )
}
