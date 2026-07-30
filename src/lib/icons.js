import {
  LayoutDashboard, Users, GitBranch, Home, CheckSquare, Star,
  MessageCircle, Map, BarChart3, QrCode, ScrollText, User, Settings,
  Search, Bell, Plus, Upload, Download, Pencil, Trash2, X, XCircle, Check,
  Phone, Mail, Calendar, AlertTriangle, AlertCircle, ChevronDown, ChevronRight,
  ChevronLeft, LogOut, Filter, ArrowRight, ArrowUpRight, Clock,
  Send, Repeat, CheckCircle2, BookOpen, Droplet, Sparkles, Crown,
  UserPlus, Heart, Smartphone, FileText, Circle, Pause, RefreshCw,
  Flag, LifeBuoy, Footprints, Building2, Compass, GraduationCap,
  Wallet, Utensils, Car, Briefcase, Accessibility, Frown, Stethoscope,
  ShieldAlert, Lock, ArrowLeft, MapPin
} from 'lucide-react'

// Point d'entree unique du systeme d'icones. Mappe chaque id de
// NAV_ITEMS (voir lib/constants.js) vers son icone Lucide. Si on
// change de bibliotheque ou de style plus tard, tout se modifie ici
// sans toucher aux pages qui consomment NAV_ICON_MAP.
export const NAV_ICON_MAP = {
  dashboard: LayoutDashboard,
  accueil: Calendar,
  visiteurs: Users,
  'fiches-a-completer': AlertTriangle,
  pipeline: GitBranch,
  fi: Home,
  suivi: CheckSquare,
  jeunesse: Star,
  communications: MessageCircle,
  carte: Map,
  rapports: BarChart3,
  qrcode: QrCode,
  journal: ScrollText,
  utilisateurs: User,
  validations: CheckSquare,
  parametres: Settings,
}

// Icones par etape du pipeline (remplace STAGES[].emoji, retire de
// lib/constants.js pour garder ce fichier comme seule source d'icones).
export const STAGE_ICON_MAP = {
  visiteur: Users,
  contacte: Phone,
  invite_fi: Send,
  fi1: Home,
  fi2: Repeat,
  integre: CheckCircle2,
  parcours: BookOpen,
  bapteme: Droplet,
  service: Sparkles,
  leader_pot: Star,
  leader: Crown,
}

// Icones par statut de FIJ (remplace les emojis de statusInfo() dans
// FIClient.jsx : En developpement / Active / En pause / Fermee).
export const FI_STATUS_ICON_MAP = {
  en_developpement: RefreshCw,
  active: CheckCircle2,
  en_pause: Pause,
  fermee: XCircle,
}

// Icones par type d'entree du journal FIJ (remplace JOURNAL_TYPES[].icon
// dans FIClient.jsx).
export const JOURNAL_TYPE_ICON_MAP = {
  priere: Heart,
  besoin: LifeBuoy,
  difficulte: AlertTriangle,
  remarque: MessageCircle,
  action: CheckCircle2,
  decision: Flag,
}

// Icones par methode de contact (utilise dans FIClient, NewcomerReportPanel)
export const CONTACT_METHOD_ICON_MAP = {
  appel: Phone,
  telephone: Phone,
  whatsapp: MessageCircle,
  sms: Smartphone,
  visite: Footprints,
  rencontre_culte: Building2,
  audio: Phone,
  autre: FileText,
}

// Icones par categorie de besoin (remplace NEED_CATEGORIES[].emoji,
// retire de lib/constants.js). Certaines icones sont volontairement
// reutilisees entre categories proches plutot que de risquer un nom
// d'icone Lucide incertain qui casserait tout le build.
export const NEED_ICON_MAP = {
  nouveau_converti: Sparkles,
  reconciliation: Users,
  demande_bapteme: Droplet,
  besoin_accompagnement: Compass,
  sujet_priere: Heart,
  solitude: User,
  parent_isole: User,
  etudiant: GraduationCap,
  difficulte_financiere: Wallet,
  difficulte_alimentaire: Utensils,
  difficulte_logement: Home,
  difficulte_transport: Car,
  recherche_emploi: Briefcase,
  recherche_formation: BookOpen,
  handicap: Accessibility,
  depression: Frown,
  maladie: Stethoscope,
  addiction: AlertTriangle,
  violence_familiale: ShieldAlert,
  besoin_fi: Home,
  besoin_mentor: UserPlus,
  autre: FileText,
}

// Icones generiques reutilisables pour actions et statuts courants
export {
  Search, Bell, Plus, Upload, Download, Pencil, Trash2, X, XCircle, Check,
  Phone, Mail, Calendar, AlertTriangle, AlertCircle, ChevronDown, ChevronRight,
  ChevronLeft, LogOut, Filter, ArrowRight, ArrowUpRight, Clock,
  Settings, Users, Home, MessageCircle, Star, GitBranch, BarChart3, CheckSquare,
  Send, Repeat, CheckCircle2, BookOpen, Droplet, Sparkles, Crown,
  UserPlus, Heart, Smartphone, FileText, Circle, Pause, RefreshCw,
  Flag, LifeBuoy, Footprints, Building2, Compass, GraduationCap,
  Wallet, Utensils, Car, Briefcase, Accessibility, Frown, Stethoscope,
  ShieldAlert, Lock, ArrowLeft, MapPin
}
