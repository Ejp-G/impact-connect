import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

const STATUS_LABELS = {
  valid: { label: 'Valide', color: '#16a34a', bg: '#f0fdf4' },
  duplicate: { label: 'Doublon', color: '#b45309', bg: '#fffbeb' },
  incomplete: { label: 'Incomplet', color: '#b91c1c', bg: '#fef2f2' },
  excluded: { label: 'Déjà importé', color: '#667085', bg: '#f9fafb' },
};

const FIELD_LABELS = {
  nom: 'Nom',
  prenom: 'Prénom',
  telephone: 'Téléphone',
  email: 'Email',
  date_arrivee: 'Date d\'arrivée',
  statut: 'Statut',
  sujet_priere: 'Sujet de prière',
  commune: 'Commune',
  star_referent: 'STAR référent',
  connecteur: 'Connecteur',
  besoin_covoiturage: 'Covoiturage',
};

export default function ImportPreviewPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/import/${batchId}/rows`);
    const data = await res.json();
    setBatch(data.batch);
    setRows(data.rows || []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(row) {
    setEditingRowId(row.id);
    setEditValues(row.mapped_data || {});
  }

  async function saveEdit(row) {
    // Recalcule un statut simple: si les champs requis sont remplis, on considère "valid"
    const hasName = editValues.nom && editValues.prenom;
    const hasContact = editValues.telephone || editValues.email;
    const newStatus = hasName && hasContact ? 'valid' : 'incomplete';

    const res = await fetch(`/api/import/${batchId}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: row.id, mapped_data: editValues, status: newStatus }),
    });

    if (res.ok) {
      setEditingRowId(null);
      load();
    }
  }

  async function handleCommit() {
    setCommitting(true);
    setMessage(null);
    const res = await fetch(`/api/import/${batchId}/commit`, { method: 'POST' });
    const data = await res.json();
    setCommitting(false);

    if (res.ok) {
      setMessage(`${data.imported} visiteur(s) importé(s) avec succès.`);
      load();
    } else {
      setMessage(`Erreur: ${data.error}`);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Chargement de l'aperçu…</div>;

  if (batch?.status === 'processing') {
    return <div style={{ padding: 40 }}>Analyse du fichier en cours… rechargez dans quelques instants.</div>;
  }

  const validCount = rows.filter((r) => r.status === 'valid').length;

  return (
    <div className="preview-page">
      <style>{`
        .preview-page { padding: 32px; max-width: 1200px; margin: 0 auto; }
        .preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .preview-summary { display: flex; gap: 12px; margin-bottom: 20px; }
        .summary-pill { padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
        table.preview-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; }
        table.preview-table th { text-align: left; font-size: 12px; text-transform: uppercase; color: #667085; padding: 10px 12px; background: #f9fafb; }
        table.preview-table td { padding: 10px 12px; font-size: 14px; border-top: 1px solid #eee; }
        .status-badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .row-actions button { margin-right: 6px; font-size: 12px; padding: 4px 8px; border-radius: 6px; border: 1px solid #d0d5dd; background: #fff; cursor: pointer; }
        .commit-button { padding: 12px 20px; background: #1e3a8a; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .commit-button:disabled { opacity: 0.5; cursor: not-allowed; }
        .edit-input { width: 100%; padding: 4px 6px; font-size: 13px; border: 1px solid #d0d5dd; border-radius: 4px; }
        .message-banner { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; background: #f0fdf4; color: #166534; }
      `}</style>

      <div className="preview-header">
        <div>
          <h1>Aperçu de l'import — {batch?.file_name}</h1>
          <p>{rows.length} ligne(s) détectée(s)</p>
        </div>
        <button className="commit-button" onClick={handleCommit} disabled={committing || validCount === 0}>
          {committing ? 'Import en cours…' : `Valider et importer (${validCount})`}
        </button>
      </div>

      {message && <div className="message-banner">{message}</div>}

      <div className="preview-summary">
        {Object.entries(STATUS_LABELS).map(([key, { label, color, bg }]) => {
          const count = rows.filter((r) => r.status === key).length;
          if (count === 0) return null;
          return (
            <span key={key} className="summary-pill" style={{ color, background: bg }}>
              {label}: {count}
            </span>
          );
        })}
      </div>

      <table className="preview-table">
        <thead>
          <tr>
            <th>Statut</th>
            <th>Nom / Prénom</th>
            <th>Contact</th>
            <th>Commune</th>
            <th>Détails</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const s = STATUS_LABELS[row.status] || STATUS_LABELS.incomplete;
            const isEditing = editingRowId === row.id;
            const d = isEditing ? editValues : row.mapped_data;

            return (
              <tr key={row.id}>
                <td>
                  <span className="status-badge" style={{ color: s.color, background: s.bg }}>
                    {s.label}
                  </span>
                </td>
                <td>
                  {isEditing ? (
                    <>
                      <input
                        className="edit-input"
                        value={d.nom || ''}
                        placeholder="Nom"
                        onChange={(e) => setEditValues({ ...editValues, nom: e.target.value })}
                      />
                      <input
                        className="edit-input"
                        value={d.prenom || ''}
                        placeholder="Prénom"
                        onChange={(e) => setEditValues({ ...editValues, prenom: e.target.value })}
                      />
                    </>
                  ) : (
                    <>{d.prenom} {d.nom}</>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <>
                      <input
                        className="edit-input"
                        value={d.telephone || ''}
                        placeholder="Téléphone"
                        onChange={(e) => setEditValues({ ...editValues, telephone: e.target.value })}
                      />
                      <input
                        className="edit-input"
                        value={d.email || ''}
                        placeholder="Email"
                        onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                      />
                    </>
                  ) : (
                    <>{d.telephone}<br />{d.email}</>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      className="edit-input"
                      value={d.commune || ''}
                      onChange={(e) => setEditValues({ ...editValues, commune: e.target.value })}
                    />
                  ) : (
                    d.commune
                  )}
                </td>
                <td style={{ fontSize: 12, color: '#667085' }}>
                  {d.statut && <div>{FIELD_LABELS.statut}: {d.statut}</div>}
                  {d.sujet_priere && <div>{FIELD_LABELS.sujet_priere}: {d.sujet_priere}</div>}
                  {d.star_referent && <div>{FIELD_LABELS.star_referent}: {d.star_referent}</div>}
                </td>
                <td style={{ fontSize: 12, color: '#667085' }}>{row.status_reason}</td>
                <td className="row-actions">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(row)}>Enregistrer</button>
                      <button onClick={() => setEditingRowId(null)}>Annuler</button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(row)}>Corriger</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
