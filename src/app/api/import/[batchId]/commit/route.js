import { createClient } from '@supabase/supabase-js';
import { VISITEURS_TABLE, COLUMN_MAP, SITUATION_FIELDS } from '@/lib/import/config';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Convertit un enregistrement mappe (champs canoniques) en ligne prete pour `contacts`.
// Les champs surs (COLUMN_MAP) sont copies tels quels vers leur vraie
// colonne. Les champs a risque (SITUATION_FIELDS) sont consolides en
// texte lisible dans `situation` plutot que d'etre mal assignes a une
// colonne technique (ex: stage, assigned_to) qu'ils ne peuvent pas
// remplir correctement automatiquement.
function toVisiteurRecord(mappedData) {
  const record = {};
  Object.entries(COLUMN_MAP).forEach(([canonicalField, columnName]) => {
    if (mappedData[canonicalField] !== undefined && mappedData[canonicalField] !== '') {
      record[columnName] = mappedData[canonicalField];
    }
  });

  const situationLines = Object.entries(SITUATION_FIELDS)
    .map(([canonicalField, label]) => {
      const value = mappedData[canonicalField];
      return (value !== undefined && value !== '') ? `${label} : ${value}` : null;
    })
    .filter(Boolean);
  if (situationLines.length > 0) {
    record.situation = situationLines.join('\n');
  }

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
