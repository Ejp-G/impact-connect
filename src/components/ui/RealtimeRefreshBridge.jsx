'use client'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

// Composant "pont" invisible (ne rend rien) : permet de brancher
// useRealtimeRefresh dans une page qui est entierement un Server
// Component (pas de fichier XClient.jsx separe), sans avoir a convertir
// toute la page en 'use client'. A inserer n'importe ou dans le JSX
// d'une page serveur, ex: <RealtimeRefreshBridge tables={['contacts']} />
export default function RealtimeRefreshBridge({ tables }) {
  useRealtimeRefresh(tables)
  return null
}
