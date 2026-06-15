export const STAGES = [
  { id:'visiteur',    label:'Visiteur',          color:'#94A3B8', emoji:'👋' },
  { id:'contacte',    label:'Contacté',           color:'#3B82F6', emoji:'📞' },
  { id:'invite_fi',   label:'Invitation FI',      color:'#8B5CF6', emoji:'📩' },
  { id:'fi1',         label:'1ère FI',            color:'#06B6D4', emoji:'🏠' },
  { id:'fi2',         label:'2ème FI',            color:'#0EA5E9', emoji:'🔄' },
  { id:'integre',     label:'Intégré FI',         color:'#22C55E', emoji:'✅' },
  { id:'parcours',    label:'Parcours Disciple',  color:'#10B981', emoji:'📖' },
  { id:'bapteme',     label:'Baptême',            color:'#F59E0B', emoji:'💧' },
  { id:'service',     label:'Service',            color:'#F97316', emoji:'🙌' },
  { id:'leader_pot',  label:'Leader Potentiel',   color:'#EF4444', emoji:'⭐' },
  { id:'leader',      label:'Leader',             color:'#0B3D91', emoji:'👑' },
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
