import {
  LayoutDashboard, Users, GitBranch, Home, CheckSquare, Star,
  MessageCircle, Map, BarChart3, QrCode, ScrollText, User, Settings,
  Search, Bell, Plus, Upload, Download, Pencil, Trash2, X, Check,
  Phone, Mail, Calendar, AlertTriangle, ChevronDown, ChevronRight,
  ChevronLeft, LogOut, Filter, ArrowRight, ArrowUpRight, Clock
} from 'lucide-react'

// Point d'entree unique du systeme d'icones. Mappe chaque id de
// NAV_ITEMS (voir lib/constants.js) vers son icone Lucide. Si on
// change de bibliotheque ou de style plus tard, tout se modifie ici
// sans toucher aux pages qui consomment NAV_ICON_MAP.
export const NAV_ICON_MAP = {
  dashboard: LayoutDashboard,
  visiteurs: Users,
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
  parametres: Settings,
}

// Icones generiques reutilisables pour actions et statuts courants
// (recherche, notifications, ajout, edition, suppression, etc.)
export {
  Search, Bell, Plus, Upload, Download, Pencil, Trash2, X, Check,
  Phone, Mail, Calendar, AlertTriangle, ChevronDown, ChevronRight,
  ChevronLeft, LogOut, Filter, ArrowRight, ArrowUpRight, Clock,
  Settings, Users, Home, MessageCircle, Star, GitBranch, BarChart3
}
