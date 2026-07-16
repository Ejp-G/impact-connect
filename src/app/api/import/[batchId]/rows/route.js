import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: liste toutes les lignes d'un lot (pour l'aperçu)
export async function GET(request, { params }) {
  const { batchId } = params;

  const { data: batch } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  const { data: rows, error } = await supabase
    .from('import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_index', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ batch, rows });
}

// PATCH: corrige une ligne spécifique (édition manuelle avant validation)
// body: { rowId, mapped_data, status }
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { rowId, mapped_data, status } = body;

    if (!rowId) {
      return Response.json({ error: 'rowId requis' }, { status: 400 });
    }

    const update = { updated_at: new Date().toISOString() };
    if (mapped_data) update.mapped_data = mapped_data;
    if (status) update.status = status;

    const { data, error } = await supabase
      .from('import_rows')
      .update(update)
      .eq('id', rowId)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ row: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
