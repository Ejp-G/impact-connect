import { createClient } from '@supabase/supabase-js';
import { VISITEURS_TABLE, COLUMN_MAP, SITUATION_FIELDS } from '@/lib/import/config';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Convertit une date au format francais (JJ/MM/AAAA ou JJ-MM-AAAA) ou
// deja ISO vers le format ISO (AAAA-MM-JJ) attendu par PostgreSQL.
// Sans cette conversion, PostgreSQL tente de lire "28/12/2025" comme
// MM/JJ/AAAA et rejette la ligne entiere (28 n'est pas un mois valide).
// Retourne null si le format n'est pas reconnu, plutot que de planter
// l'insertion : le champ sera simplement laisse vide pour cette ligne.
function normalizeDateFr(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, day, month, year] = m;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Convertit un enregistrement mappe (champs canoniques) en ligne prete pour `contacts`.
// Les champs surs (COLUMN_MAP) sont copies tels quels vers leur vraie
// colonne. Les champs a risque (SITUATION_FIELDS) sont consolides en
// texte lisible dans `situation` plutot que d'etre mal assignes a une
// colonne technique (ex: stage, assigned_to) qu'ils ne peuvent pas
// remplir correctement automatiquement.
function toVisiteurRecord(mappedData) {
  const record = {};
  Object.entries(COLUMN_MAP).forEach(([canonicalField, columnName]) => {
    let value = mappedData[canonicalField];
    if (value === undefined || value === '') return;
    if (canonicalField === 'date_arrivee') {
      value = normalizeDateFr(value);
      if (!value) return; // format illisible : on ignore ce champ plutot que de faire planter la ligne
    }
    record[columnName] = value;
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
