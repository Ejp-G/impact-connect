// lib/phone.js
//
// Utilitaires de formatage téléphonique international, partagés par
// tout composant ayant besoin d'un lien wa.me ou tel: valide.
// Remplace la version qui vivait uniquement dans NewcomerReportPanel.jsx
// — comportement par défaut inchangé (Guadeloupe/590 si aucun indicatif
// n'est détecté) pour ne rien casser sur les numéros déjà saisis.
//
// Pas de nouvelle colonne "pays" sur contacts : la détection se fait
// uniquement à partir des chiffres du numéro. Voir section 24-25 du
// cahier des charges — si un champ pays est ajouté un jour à la fiche
// contact, ce fichier pourra s'en servir en priorité.

export const COUNTRY_CODES = [
  { code: '590', flag: '🇬🇵', label: 'Guadeloupe' },
  { code: '596', flag: '🇲🇶', label: 'Martinique' },
  { code: '594', flag: '🇬🇫', label: 'Guyane' },
  { code: '262', flag: '🇷🇪', label: 'La Réunion' },
  { code: '33',  flag: '🇫🇷', label: 'France' },
  { code: '32',  flag: '🇧🇪', label: 'Belgique' },
  { code: '41',  flag: '🇨🇭', label: 'Suisse' },
  { code: '1',   flag: '🇨🇦', label: 'Canada' },
]

const DEFAULT_COUNTRY_CODE = '590' // Guadeloupe — comportement historique

// Détecte l'indicatif déjà présent dans un numéro, trié par longueur
// décroissante pour qu'un "1" (Canada) ne matche pas par erreur le
// début d'un "594"/"596"/etc.
function detectCountryCode(digits) {
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  return sorted.find(c => digits.startsWith(c.code)) || null
}

// Formate un numéro pour un lien wa.me / tel: valide : indicatif +
// numéro local, sans 0 initial, sans espaces/tirets/parenthèses.
export function formatWhatsappNumber(rawPhone, fallbackCountryCode = DEFAULT_COUNTRY_CODE) {
  if (!rawPhone) return null
  const digits = String(rawPhone).replace(/\D/g, '')
  if (!digits) return null

  const detected = detectCountryCode(digits)
  if (detected) return digits

  const withoutLeadingZero = digits.startsWith('0') ? digits.slice(1) : digits
  return `${fallbackCountryCode}${withoutLeadingZero}`
}

// Numéro affichable avec le drapeau du pays détecté (section 25).
// Retourne null si aucun indicatif n'est identifiable.
export function getPhoneCountryDisplay(rawPhone) {
  if (!rawPhone) return null
  const digits = String(rawPhone).replace(/\D/g, '')
  const detected = detectCountryCode(digits)
  if (!detected) return null
  return `${detected.flag} +${detected.code}`
}
