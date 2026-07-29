import { UserPlus, Phone, Send, Home, RefreshCw, CheckCircle2, BookOpen, Droplet, Heart, Award, Crown } from 'lucide-react'

export const STAGES = [
  { id:'visiteur',    label:'Visiteur',          color:'#94A3B8' },
  { id:'contacte',    label:'Contacté',           color:'#3B82F6' },
  { id:'invite_fi',   label:'Invitation FI',      color:'#8B5CF6' },
  { id:'fi1',         label:'1ère FI',            color:'#06B6D4' },
  { id:'fi2',         label:'2ème FI',            color:'#0EA5E9' },
  { id:'integre',     label:'Intégré FI',         color:'#22C55E' },
  { id:'parcours',    label:'Parcours Disciple',  color:'#10B981' },
  { id:'bapteme',     label:'Baptême',            color:'#F59E0B' },
  { id:'service',     label:'Service',            color:'#F97316' },
  { id:'leader_pot',  label:'Leader Potentiel',   color:'#EF4444' },
  { id:'leader',      label:'Leader',             color:'#0B3D91' },
]
export const ROLES = {
  admin:                   'Administrateur général',
  responsable_integration: 'Resp. Intégration',
  equipe_integration:      'Équipe Intégration',
  responsable_suivi:       'Resp. Suivi',
  equipe_suivi:            'Équipe Suivi',
  pilote_fi:               'Pilote FI',
  superviseur:             'Superviseur',
  responsable_jeunesse:    'Resp. Jeunesse',
}
export const ROLE_NAV = {
  admin:                   'all',
  responsable_integration: ['dashboard','visiteurs','pipeline','suivi','qrcode','journal','rapports','parametres'],
  equipe_integration:      ['visiteurs','qrcode'],
  responsable_suivi:       ['dashboard','visiteurs','suivi','communications','rapports'],
  equipe_suivi:            ['visiteurs','suivi','communications'],
  pilote_fi:               ['fi','suivi','communications','qrcode'],
  superviseur:             ['dashboard','visiteurs','pipeline','fi','suivi','rapports','carte','communications'],
  responsable_jeunesse:    ['jeunesse','visiteurs','communications'],
}
export const NAV_ITEMS = [
  { id:'dashboard',       label:"Tableau de bord",      icon:'📊', href:'/dashboard' },
  { id:'visiteurs',       label:'Visiteurs',             icon:'👥', href:'/visiteurs',       badge:'contacts' },
  { id:'pipeline',        label:'Pipeline',              icon:'🔀', href:'/pipeline' },
  { id:'fi',              label:"Familles d'Impact",     icon:'🏠', href:'/fi' },
  { id:'suivi',           label:'Suivi & Tâches',        icon:'✅', href:'/suivi',            badge:'tasks' },
  { id:'jeunesse',        label:'Jeunesse',              icon:'🌟', href:'/jeunesse' },
  { id:'communications',  label:'Communications',        icon:'💬', href:'/communications' },
  { id:'carte',           label:'Carte Guadeloupe',      icon:'🗺️', href:'/carte' },
  { id:'rapports',        label:'Rapports',              icon:'📋', href:'/rapports' },
  { id:'qrcode',          label:'Formulaire QR',         icon:'📲', href:'/qrcode' },
  { id:'journal',         label:"Journal d'activité",    icon:'📜', href:'/journal' },
  { id:'utilisateurs',    label:'Utilisateurs',          icon:'👤', href:'/utilisateurs' },
  { id:'parametres',      label:'Paramètres',            icon:'⚙️', href:'/parametres' },
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

// Icones Lucide par etape (remplace stage.emoji dans l'UI : kanban
// Pipeline, "Pipeline complet" des Rapports, etc.)
export const STAGE_ICON_MAP = {
  visiteur: UserPlus, contacte: Phone, invite_fi: Send, fi1: Home, fi2: RefreshCw,
  integre: CheckCircle2, parcours: BookOpen, bapteme: Droplet, service: Heart,
  leader_pot: Award, leader: Crown,
}
export const STAGE_ICON = (id) => STAGE_ICON_MAP[id] || Home

// Besoins detectes progressivement au fil des echanges (jamais demandes
// frontalement des la premiere visite). Les 3 marques sensible:true sont
// restreintes a admin/responsable_suivi cote base (voir politiques RLS
// de contact_needs), et cote UI (voir SuiviClient / NeedsDrilldownModal).
export const NEED_CATEGORIES = [
  { id:'nouveau_converti',        domain:'spirituel', label:'Nouveau converti',              emoji:'✝️' },
  { id:'reconciliation',          domain:'spirituel', label:'Réconciliation',                emoji:'🤝' },
  { id:'demande_bapteme',         domain:'spirituel', label:'Demande de baptême',             emoji:'💧' },
  { id:'besoin_accompagnement',   domain:'spirituel', label:"Besoin d'accompagnement",        emoji:'🧭' },
  { id:'sujet_priere',            domain:'spirituel', label:'Sujet de prière',                emoji:'🙏' },
  { id:'solitude',                domain:'personnel', label:'Solitude',                       emoji:'💭' },
  { id:'parent_isole',            domain:'personnel', label:'Parent isolé',                   emoji:'👩' },
  { id:'etudiant',                domain:'personnel', label:'Étudiant',                       emoji:'🎓' },
  { id:'difficulte_financiere',   domain:'personnel', label:'Difficultés financières',        emoji:'💰' },
  { id:'difficulte_alimentaire',  domain:'personnel', label:'Difficultés alimentaires',       emoji:'🍞' },
  { id:'difficulte_logement',     domain:'personnel', label:'Difficultés de logement',        emoji:'🏠' },
  { id:'difficulte_transport',    domain:'personnel', label:'Difficultés de transport',       emoji:'🚗' },
  { id:'recherche_emploi',        domain:'personnel', label:"Recherche d'emploi",             emoji:'💼' },
  { id:'recherche_formation',     domain:'personnel', label:'Recherche de formation',         emoji:'📚' },
  { id:'handicap',                domain:'personnel', label:'Handicap',                       emoji:'♿' },
  { id:'depression',              domain:'personnel', label:'Dépression',                     emoji:'😔', sensitive:true },
  { id:'maladie',                 domain:'personnel', label:'Maladie',                        emoji:'🏥' },
  { id:'addiction',               domain:'personnel', label:'Addiction',                      emoji:'⚠️', sensitive:true },
  { id:'violence_familiale',      domain:'personnel', label:'Violence familiale',             emoji:'🚨', sensitive:true },
  { id:'besoin_fi',               domain:'personnel', label:"Besoin d'une Famille d'Impact",  emoji:'🏠' },
  { id:'besoin_mentor',           domain:'personnel', label:"Besoin d'un mentor",             emoji:'🧑‍🏫' },
  { id:'autre',                   domain:'personnel', label:'Autre',                          emoji:'📝' },
]
export const NEED_LABEL = (id) => NEED_CATEGORIES.find(n => n.id === id)?.label || id
export const NEED_EMOJI = (id) => NEED_CATEGORIES.find(n => n.id === id)?.emoji || '📝'
export const NEED_IS_SENSITIVE = (id) => !!NEED_CATEGORIES.find(n => n.id === id)?.sensitive
