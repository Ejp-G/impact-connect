// =========================================================
// CONFIGURATION DU MODULE IMPORT — À VÉRIFIER AVANT MISE EN PROD
// =========================================================
// Les noms de colonnes ci-dessous sont des hypothèses basées sur
// l'interface visible (page Visiteurs). Va vérifier les vrais noms
// de colonnes dans Supabase > Table Editor > visiteurs, et corrige
// COLUMN_MAP si besoin. C'est le SEUL fichier à ajuster pour que
// tout le pipeline colle à ton schéma réel.

export const VISITEURS_TABLE = 'visiteurs';

// Champs canoniques utilisés en interne par le module d'import
export const CANONICAL_FIELDS = [
  'nom',
  'prenom',
  'telephone',
  'email',
  'date_arrivee',
  'statut',            // ex: Nouveau / Réconciliation / Appelé au salut
  'sujet_priere',
  'commune',
  'star_referent',      // "STAR ayant reçu le jeune"
  'connecteur',         // "Connecteurs" — peut être une STAR différente du référent
  'besoin_covoiturage', // booléen
];

// Mapping champ canonique -> nom réel de colonne dans `visiteurs`
// ⚠️ À CORRIGER selon ton schéma réel
export const COLUMN_MAP = {
  nom: 'nom',
  prenom: 'prenom',
  telephone: 'telephone',
  email: 'email',
  date_arrivee: 'date_arrivee',
  statut: 'etape',              // supposition: "Étape" affichée dans l'UI
  sujet_priere: 'sujet_priere',
  commune: 'commune',
  star_referent: 'agent_id',     // supposition: correspond à "Agent" dans l'UI — peut nécessiter une résolution nom -> id
  connecteur: 'connecteur',
  besoin_covoiturage: 'besoin_covoiturage',
};

// Champs obligatoires pour qu'une ligne soit considérée "valide" (non incomplète)
export const REQUIRED_FIELDS = ['nom', 'prenom'];
// Au moins un moyen de contact requis
export const REQUIRED_CONTACT_FIELDS = ['telephone', 'email'];

// Seuil de confiance en dessous duquel on déclenche le fallback Claude
// pour le mapping des colonnes (0 à 1)
export const CONFIDENCE_THRESHOLD = 0.6;

export const ANTHROPIC_MODEL = 'claude-sonnet-5';
