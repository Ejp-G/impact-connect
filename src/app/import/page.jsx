import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.error || 'Erreur upload');

      const batchId = uploadData.batch.id;

      // Lance le traitement (extraction + mapping + dédoublonnage)
      const processRes = await fetch(`/api/import/${batchId}/process`, { method: 'POST' });
      const processData = await processRes.json();

      if (!processRes.ok) throw new Error(processData.error || 'Erreur de traitement');

      router.push(`/import/${batchId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="import-page">
      <style>{`
        .import-page {
          max-width: 560px;
          margin: 60px auto;
          padding: 32px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .import-page h1 { font-size: 20px; margin-bottom: 8px; }
        .import-page p.subtitle { color: #667085; margin-bottom: 24px; }
        .import-dropzone {
          border: 2px dashed #d0d5dd;
          border-radius: 10px;
          padding: 32px;
          text-align: center;
          margin-bottom: 20px;
        }
        .import-dropzone input { margin-top: 12px; }
        .import-submit {
          width: 100%;
          padding: 12px;
          background: #1e3a8a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .import-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .import-error {
          background: #fef2f2;
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }
      `}</style>

      <h1>Import intelligent de visiteurs</h1>
      <p className="subtitle">Excel (.xlsx), CSV ou PDF — l'analyse est automatique.</p>

      {error && <div className="import-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="import-dropzone">
          <div>Glissez un fichier ou sélectionnez-en un</div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>
        <button className="import-submit" type="submit" disabled={!file || loading}>
          {loading ? 'Analyse en cours…' : 'Importer et analyser'}
        </button>
      </form>
    </div>
  );
}
