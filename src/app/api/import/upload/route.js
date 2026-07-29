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

// Supabase Storage refuse les espaces, accents et certains caracteres
// speciaux dans les cles de fichiers. On "assainit" le nom UNIQUEMENT
// pour la cle technique de stockage ; le nom original (file.name) reste
// conserve tel quel dans la base pour l'affichage a l'utilisateur.
function sanitizeFileName(name) {
  const dotIndex = name.lastIndexOf('.');
  const ext = dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
  const base = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const safeBase = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents (e -> e)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')                  // remplace le reste par _
    .replace(/_+/g, '_')                               // evite les _ repetes
    .replace(/^_|_$/g, '')                              // retire les _ en bordure
    .slice(0, 100) || 'fichier';
  return `${safeBase}${ext}`;
}

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
    const storagePath = `${Date.now()}-${sanitizeFileName(file.name)}`;
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
