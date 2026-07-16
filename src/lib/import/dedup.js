import { normalizePhone, normalizeEmail } from './fieldDictionary';
import { VISITEURS_TABLE, COLUMN_MAP, REQUIRED_FIELDS, REQUIRED_CONTACT_FIELDS } from './config';

// Charge tous les visiteurs existants (téléphone/email normalisés) une seule fois
// pour éviter une requête par ligne importée.
export async function loadExistingContacts(supabase) {
  const { data, error } = await supabase
    .from(VISITEURS_TABLE)
    .select(`id, ${COLUMN_MAP.telephone}, ${COLUMN_MAP.email}, ${COLUMN_MAP.nom}, ${COLUMN_MAP.prenom}`);

  if (error) throw error;

  const byPhone = new Map();
  const byEmail = new Map();

  for (const visiteur of data) {
    const phone = normalizePhone(visiteur[COLUMN_MAP.telephone]);
    const email = normalizeEmail(visiteur[COLUMN_MAP.email]);
    if (phone) byPhone.set(phone, visiteur);
    if (email) byEmail.set(email, visiteur);
  }

  return { byPhone, byEmail };
}

// Détermine le statut d'une ligne importée: 'valid' | 'duplicate' | 'incomplete'
export function evaluateRowStatus(mappedRecord, existingContacts) {
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mappedRecord[f]);
  const hasContact = REQUIRED_CONTACT_FIELDS.some((f) => mappedRecord[f]);

  if (missingRequired.length > 0 || !hasContact) {
    return {
      status: 'incomplete',
      reason: `Champs manquants: ${[...missingRequired, !hasContact ? 'téléphone ou email' : null]
        .filter(Boolean)
        .join(', ')}`,
    };
  }

  const phone = normalizePhone(mappedRecord.telephone);
  const email = normalizeEmail(mappedRecord.email);

  const phoneMatch = phone && existingContacts.byPhone.get(phone);
  const emailMatch = email && existingContacts.byEmail.get(email);
  const match = phoneMatch || emailMatch;

  if (match) {
    return {
      status: 'duplicate',
      reason: `Correspond à ${match[COLUMN_MAP.prenom] || ''} ${match[COLUMN_MAP.nom] || ''} déjà existant(e)`,
      duplicateId: match.id,
    };
  }

  return { status: 'valid', reason: null };
}
