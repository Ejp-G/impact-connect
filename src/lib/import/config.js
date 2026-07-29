// =========================================================
// CONFIGURATION DU MODULE IMPORT — corrigee et verifiee
// =========================================================
// La table et les colonnes ci-dessous pointent maintenant vers le vrai
// schema de l'application (table `contacts`, colonnes en anglais),
// meme si les champs canoniques utilises en interne par le module
// d'import restent en francais (nom, prenom, telephone...) puisque
// c'est aussi la langue du formulaire ImportModal.jsx.
export const VISITEURS_TABLE = 'contacts';

// Champs canoniques utilises en interne par le module d'import
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

// Mapping champ canonique -> nom REEL de colonne dans `contacts`.
// IMPORTANT : statut, star_referent, connecteur et besoin_covoiturage
// sont volontairement ABSENTS d'ici. Ce ne sont pas des simples
// traductions : 'statut' ne correspond pas aux valeurs strictes
// acceptees par contacts.stage (visiteur/contacte/integre/...) et
// ecrire n'importe quoi dedans casserait le pipeline. 'star_referent'
// est un NOM en texte libre dans le fichier source, alors que la
// vraie colonne (assigned_to) attend un identifiant technique — pas
// de correspondance fiable possible sans intervention humaine.
// 'connecteur' et 'besoin_covoiturage' n'ont simplement aucune colonne
// equivalente dans cette application (le 2e semble relever de
// Mobilite Hub, une application distincte).
// Ces 4 champs sont donc consolides en texte lisible dans le champ
// `situation` (notes libres) par commit/route.js, plutot que d'etre
// mappes ici — rien n'est perdu, rien n'est mal assigne.
export const COLUMN_MAP = {
  nom: 'last_name',
  prenom: 'first_name',
  telephone: 'phone',
  email: 'email',
  date_arrivee: 'first_visit_date',
  commune: 'commune',
  sujet_priere: 'prayer_request',
};

// Champs consolides en texte libre dans `situation` au moment du commit
// (voir commit/route.js), avec leur libelle d'affichage.
export const SITUATION_FIELDS = {
  statut: 'Statut (import)',
  star_referent: 'STAR référent (import)',
  connecteur: 'Connecteur (import)',
  besoin_covoiturage: 'Besoin covoiturage (import)',
};

// Champs obligatoires pour qu'une ligne soit consideree "valide" (non incomplete)
export const REQUIRED_FIELDS = ['nom', 'prenom'];

// Au moins un moyen de contact requis
export const REQUIRED_CONTACT_FIELDS = ['telephone', 'email'];

// Seuil de confiance en dessous duquel on declenche le fallback Claude
// pour le mapping des colonnes (0 a 1)
export const CONFIDENCE_THRESHOLD = 0.6;
export const ANTHROPIC_MODEL = 'claude-sonnet-5';
