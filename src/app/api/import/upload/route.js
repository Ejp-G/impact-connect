import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/csv': 'csv',
  'application/pdf': 'pdf',
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'Aucun fichier reçu' }, { status: 400 });
    }

    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      return Response.json(
        { error: 'Format non supporté. Utilisez Excel (.xlsx), CSV ou PDF.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storagePath = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('imports')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadError) {
      return Response.json({ error: `Erreur de stockage: ${uploadError.message}` }, { status: 500 });
    }

    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        file_name: file.name,
        file_type: fileType,
        storage_path: storagePath,
        status: 'uploaded',
      })
      .select()
      .single();

    if (batchError) {
      return Response.json({ error: `Erreur création lot: ${batchError.message}` }, { status: 500 });
    }

    return Response.json({ batch });
  } catch (err) {
    console.error('Upload error:', err);
    return Response.json({ error: 'Erreur inattendue lors de l\'upload' }, { status: 500 });
  }
}
