import { createClient } from '@supabase/supabase-js';
import { VISITEURS_TABLE, COLUMN_MAP } from '@/lib/import/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Convertit un enregistrement mappé (champs canoniques) en ligne prête pour `visiteurs`
function toVisiteurRecord(mappedData) {
  const record = {};
  Object.entries(COLUMN_MAP).forEach(([canonicalField, columnName]) => {
    if (mappedData[canonicalField] !== undefined && mappedData[canonicalField] !== '') {
      record[columnName] = mappedData[canonicalField];
    }
  });
  return record;
}

// POST: insère toutes les lignes du lot dont le statut est 'valid'
// (les 'duplicate' et 'incomplete' sont ignorées sauf si l'utilisateur les a
// requalifiées en 'valid' via le PATCH sur /rows après correction manuelle)
export async function POST(request, { params }) {
  const { batchId } = params;

  try {
    await supabase.from('import_batches').update({ status: 'committing' }).eq('id', batchId);

    const { data: rows, error: rowsError } = await supabase
      .from('import_rows')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'valid');

    if (rowsError) throw rowsError;

    if (rows.length === 0) {
      return Response.json({ error: 'Aucune ligne valide à importer' }, { status: 400 });
    }

    const visiteurRecords = rows.map((r) => toVisiteurRecord(r.mapped_data));

    const { data: inserted, error: insertError } = await supabase
      .from(VISITEURS_TABLE)
      .insert(visiteurRecords)
      .select('id');

    if (insertError) throw insertError;

    // Marque les lignes importées comme traitées (audit trail)
    await supabase
      .from('import_rows')
      .update({ status: 'excluded', status_reason: 'Importé avec succès' })
      .in(
        'id',
        rows.map((r) => r.id)
      );

    await supabase
      .from('import_batches')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', batchId);

    return Response.json({ imported: inserted.length });
  } catch (err) {
    console.error('Commit error:', err);
    await supabase
      .from('import_batches')
      .update({ status: 'error', error_message: err.message })
      .eq('id', batchId);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
