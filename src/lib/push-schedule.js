// lib/push-schedule.js
//
// Configuration centralisée des notifications push hebdomadaires pour
// les intégrateurs (Dimanche/Mardi/Jeudi) et pour le planning Accueil
// & Intégration (Lundi/Vendredi + annonce de publication). Toute heure
// ou tout type utilisé pour ces notifications doit passer par ce
// fichier plutôt que d'être redéfini ailleurs.

export const PUSH_TIMEZONE = 'America/Guadeloupe' // UTC-4 fixe, pas de changement d'heure

export const PUSH_TYPES = {
  DIMANCHE: 'push_dimanche_attribution',
  MARDI: 'push_mardi_rappel',
  JEUDI: 'push_jeudi_relance',
  PLANNING_LUNDI: 'push_planning_lundi',
  PLANNING_VENDREDI: 'push_planning_vendredi',
  PLANNING_PUBLIE: 'push_planning_publie',
}
