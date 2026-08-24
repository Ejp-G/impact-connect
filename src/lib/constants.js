export const STAGES = [
  { id:'visiteur',    label:'Visiteur',          color:'#94A3B8' },
  { id:'contacte',    label:'Contacté',           color:'#3B82F6' },
  { id:'invite_fi',   label:'Invitation FI',      color:'#8B5CF6' },
  { id:'fi1',         label:'1ère FI',            color:'#06B6D4' },
  { id:'fi2',         label:'2ème FI',            color:'#0EA5E9' },
  { id:'integre',     label:'Intégré FI',         color:'#22C55E' },
  { id:'parcours',    label:'Parcours de croissance', color:'#10B981' },
  { id:'bapteme',     label:'Baptême',            color:'#F59E0B' },
  { id:'service',     label:'Service',            color:'#F97316' },
  { id:'leader_pot',  label:'Leader Potentiel',   color:'#EF4444' },
  { id:'leader',      label:'Leader',             color:'#0B3D91' },
]
export const ROLES = {
  admin:                   'Administrateur général',
  equipe_accueil:          'Équipe Accueil',
  responsable_suivi:       'Resp. Suivi & Intégration',
  equipe_suivi:            'Équipe Suivi & Intégration',
  pilote_fi:               'Pilote FI',
  superviseur:             'Superviseur',
  responsable_jeunesse:    'Resp. Jeunesse',
}
export const ROLE_NAV = {
  admin:                   'all',
  equipe_accueil:          ['accueil','planning'],
  responsable_suivi:       ['dashboard','accueil','visiteurs','fiches-a-completer','pipeline','suivi','qrcode','journal','rapports','parametres','communications','planning'],
  equipe_suivi:            ['dashboard','accueil','visiteurs','fiches-a-completer','pipeline','suivi','jeunesse','carte','rapports','qrcode','communications','planning'],
  pilote_fi:               ['fi','suivi','communications','qrcode'],
  superviseur:             ['dashboard','accueil','visiteurs','pipeline','fi','suivi','rapports','carte','communications','jeunesse','fiches-a-completer','qrcode','validations','planning'],
  responsable_jeunesse:    ['jeunesse','visiteurs','communications'],
}
export const NAV_ITEMS = [
  { id:'dashboard',       label:"Tableau de bord",      href:'/dashboard' },
  { id:'accueil',         label:'Accueil',               href:'/accueil' },
  { id:'visiteurs',       label:'Visiteurs',             href:'/visiteurs',       badge:'contacts' },
  { id:'fiches-a-completer', label:'Fiches à compléter', href:'/fiches-a-completer' },
  { id:'pipeline',        label:'Pipeline',              href:'/pipeline' },
  { id:'fi',              label:"Familles d'Impact",     href:'/fi' },
  { id:'suivi',           label:'Suivi & Tâches',        href:'/suivi',            badge:'tasks' },
  { id:'jeunesse',        label:'Jeunesse',              href:'/jeunesse' },
  { id:'communications',  label:'Communications',        href:'/communications' },
  { id:'planning',        label:'Planning',              href:'/planning' },
  { id:'carte',           label:'Carte Guadeloupe',      href:'/carte' },
  { id:'rapports',        label:'Rapports',              href:'/rapports' },
  { id:'qrcode',          label:'Formulaire QR',         href:'/qrcode' },
  { id:'journal',         label:"Journal d'activité",    href:'/journal' },
  { id:'utilisateurs',    label:'Utilisateurs',          href:'/utilisateurs' },
  { id:'validations',     label:'Demandes de validation', href:'/validations' },
  { id:'parametres',      label:'Paramètres',            href:'/parametres' },
]
export const COMMUNES_FI = {
  'Pointe-a-Pitre': 'FI PàP',
  'Abymes':         'FI Abymes',
  'Baie-Mahault':   'FI Jarry',
  'Le Gosier':      'FI Gosier',
  'Sainte-Anne':    'FI Sainte-Anne',
  'Capesterre':     'FI Capesterre',
}
export const PRIORITY_COLORS = {
  urgent: '#EF4444', high: '#F97316', normal: '#22C55E', low: '#94A3B8'
}
export const STAGE_LABEL = (id) => STAGES.find(s => s.id === id)?.label || id
export const STAGE_COLOR = (id) => STAGES.find(s => s.id === id)?.color || '#94A3B8'

// Besoins detectes progressivement au fil des echanges (jamais demandes
// frontalement des la premiere visite). Les 3 marques sensible:true sont
// restreintes a admin/responsable_suivi cote base (voir politiques RLS
// de contact_needs), et cote UI (voir SuiviClient / NeedsDrilldownModal).
// Les icones associees vivent dans lib/icons.js (NEED_ICON_MAP), pas ici.
export const NEED_CATEGORIES = [
  { id:'nouveau_converti',        domain:'spirituel', label:'Nouveau converti' },
  { id:'reconciliation',          domain:'spirituel', label:'Réconciliation' },
  { id:'demande_bapteme',         domain:'spirituel', label:'Demande de baptême' },
  { id:'besoin_accompagnement',   domain:'spirituel', label:"Besoin d'accompagnement" },
  { id:'sujet_priere',            domain:'spirituel', label:'Sujet de prière' },
  { id:'solitude',                domain:'personnel', label:'Solitude' },
  { id:'parent_isole',            domain:'personnel', label:'Parent isolé' },
  { id:'etudiant',                domain:'personnel', label:'Étudiant' },
  { id:'difficulte_financiere',   domain:'personnel', label:'Difficultés financières' },
  { id:'difficulte_alimentaire',  domain:'personnel', label:'Difficultés alimentaires' },
  { id:'difficulte_logement',     domain:'personnel', label:'Difficultés de logement' },
  { id:'difficulte_transport',    domain:'personnel', label:'Difficultés de transport' },
  { id:'recherche_emploi',        domain:'personnel', label:"Recherche d'emploi" },
  { id:'recherche_formation',     domain:'personnel', label:'Recherche de formation' },
  { id:'handicap',                domain:'personnel', label:'Handicap' },
  { id:'depression',              domain:'personnel', label:'Dépression', sensitive:true },
  { id:'maladie',                 domain:'personnel', label:'Maladie' },
  { id:'addiction',               domain:'personnel', label:'Addiction', sensitive:true },
  { id:'violence_familiale',      domain:'personnel', label:'Violence familiale', sensitive:true },
  { id:'besoin_fi',               domain:'personnel', label:"Besoin d'une Famille d'Impact" },
  { id:'besoin_mentor',           domain:'personnel', label:"Besoin d'un mentor" },
  { id:'autre',                   domain:'personnel', label:'Autre' },
]
export const NEED_LABEL = (id) => NEED_CATEGORIES.find(n => n.id === id)?.label || id
export const NEED_IS_SENSITIVE = (id) => !!NEED_CATEGORIES.find(n => n.id === id)?.sensitive
