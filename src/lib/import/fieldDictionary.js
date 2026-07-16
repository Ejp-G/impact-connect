// =========================================================
// Dictionnaire de synonymes pour la reconnaissance heuristique
// des colonnes (français, variantes vues dans les fichiers EJP)
// =========================================================

export const FIELD_SYNONYMS = {
  nom: ['nom', 'nom de famille', 'nom de famile', 'famille'],
  prenom: ['prenom', 'prénom', 'prenoms', 'prénoms'],
  telephone: [
    'telephone', 'téléphone', 'numero de telephone', 'numéro de téléphone',
    'numero de telephone portable', 'numéro de téléphone portable',
    'tel', 'tél', 'contact', 'portable', 'numero', 'numéro',
  ],
  email: ['email', 'e-mail', 'mail', 'adresse email', 'adresse mail'],
  date_arrivee: [
    'date d\'arrivee', 'date d\'arrivée', 'date arrivee', 'date arrivée', 'date',
  ],
  statut: [
    'statut du jeune', 'statut', 'etape', 'étape', 'status',
  ],
  sujet_priere: ['sujet de priere', 'sujet de prière', 'priere', 'prière'],
  commune: [
    'commune de residence', 'commune de résidence', 'commune', 'commune / fi', 'ville',
  ],
  star_referent: [
    'star ayant recu le jeune', 'star ayant reçu le jeune', 'star ayant recu',
    'referent', 'référent',
  ],
  connecteur: ['connecteurs', 'connecteur', 'star'],
  besoin_covoiturage: [
    'besoin de covoiturage', 'covoiturage', 'besoin covoiturage',
  ],
};

// Normalise un texte pour comparaison (minuscule, sans accents, sans espaces superflus)
export function normalizeHeader(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Retourne { field, score } le champ canonique le plus probable pour un en-tête donné
export function matchHeaderToField(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return { field: null, score: 0 };

  let best = { field: null, score: 0 };

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      const normSyn = normalizeHeader(syn);
      let score = 0;
      if (normalized === normSyn) score = 1;
      else if (normalized.includes(normSyn) || normSyn.includes(normalized)) score = 0.75;
      if (score > best.score) best = { field, score };
    }
  }
  return best;
}

// Normalise un numéro de téléphone pour comparaison de doublons
// (Guadeloupe: retire espaces/tirets, compare sur les 9 derniers chiffres)
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

export function normalizeEmail(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

// Détecte les lignes "bruit" : titres de section, séparateurs, lignes quasi-vides
// Vues dans les fichiers EJP: "Jeunes reçus le dimanche ... à recontacter :"
const NOISE_PATTERNS = [
  /jeunes? re[cç]us?/i,
  /[àa] recontacter/i,
  /^jeunes? du culte/i,
];

export function isNoiseRow(cells) {
  const nonEmpty = cells.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');

  // Ligne quasi-vide (0 ou 1 cellule remplie sur une ligne censée en avoir plusieurs)
  if (nonEmpty.length <= 1 && cells.length > 2) return true;

  // Ligne qui matche un pattern connu de titre de section
  const joined = nonEmpty.join(' ');
  if (NOISE_PATTERNS.some((p) => p.test(joined))) return true;

  return false;
}
