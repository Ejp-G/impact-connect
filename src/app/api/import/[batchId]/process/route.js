import { createClient } from '@supabase/supabase-js';
import { readExcelRows, readCsvRows, parseAndMapRows } from '@/lib/import/excelCsvMapper';
import { extractRecordsFromPdf } from '@/lib/import/claudeClient';
import { loadExistingContacts, evaluateRowStatus } from '@/lib/import/dedup';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request, { params }) {
  const { batchId } = params;

  try {
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return Response.json({ error: 'Lot introuvable' }, { status: 404 });
    }

    await supabase.from('import_batches').update({ status: 'processing' }).eq('id', batchId);

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('imports')
      .download(batch.storage_path);

    if (downloadError) throw new Error(`Téléchargement échoué: ${downloadError.message}`);

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    let mappedRecords = [];
    let usedClaudeCount = 0;

    if (batch.file_type === 'xlsx') {
      const rows = readExcelRows(buffer);
      const result = await parseAndMapRows(rows);
      mappedRecords = result.mappedRecords;
      usedClaudeCount = Object.values(result.columnMapping).filter((m) => m.usedClaude).length;
    } else if (batch.file_type === 'csv') {
      const rows = readCsvRows(buffer.toString('utf-8'));
      const result = await parseAndMapRows(rows);
      mappedRecords = result.mappedRecords;
      usedClaudeCount = Object.values(result.columnMapping).filter((m) => m.usedClaude).length;
    } else if (batch.file_type === 'pdf') {
      const base64Pdf = buffer.toString('base64');
      mappedRecords = await extractRecordsFromPdf(base64Pdf);
      usedClaudeCount = mappedRecords.length; // tout le PDF passe par Claude
    }

    const existingContacts = await loadExistingContacts(supabase);

    const importRows = mappedRecords.map((record, index) => {
      const { status, reason, duplicateId } = evaluateRowStatus(record, existingContacts);
      return {
        batch_id: batchId,
        row_index: index,
        raw_data: record,
        mapped_data: record,
        status,
        status_reason: reason,
        duplicate_visiteur_id: duplicateId || null,
        used_claude_fallback: usedClaudeCount > 0,
      };
    });

    if (importRows.length > 0) {
      const { error: insertError } = await supabase.from('import_rows').insert(importRows);
      if (insertError) throw new Error(`Insertion des lignes échouée: ${insertError.message}`);
    }

    const counts = {
      total_rows: importRows.length,
      valid_rows: importRows.filter((r) => r.status === 'valid').length,
      duplicate_rows: importRows.filter((r) => r.status === 'duplicate').length,
      incomplete_rows: importRows.filter((r) => r.status === 'incomplete').length,
    };

    await supabase
      .from('import_batches')
      .update({ status: 'ready', ...counts, updated_at: new Date().toISOString() })
      .eq('id', batchId);

    return Response.json({ status: 'ready', ...counts });
  } catch (err) {
    console.error('Process error:', err);
    await supabase
      .from('import_batches')
      .update({ status: 'error', error_message: err.message })
      .eq('id', batchId);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
