'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Hook generique : ecoute les INSERT/UPDATE/DELETE sur les tables donnees
// et relance automatiquement les Server Components de la page courante
// (router.refresh()) sans recharger le navigateur. A brancher dans n'importe
// quel composant client de page (Dashboard, Pipeline, Visiteurs, Rapports,
// Carte...) avec la liste des tables dont cette page depend.
//
// Exemple : useRealtimeRefresh(['contacts', 'familles_impact'])
//
// Un anti-rebond de 300ms evite de spammer router.refresh() si plusieurs
// changements arrivent d'un coup (ex: import en masse de visiteurs).
export function useRealtimeRefresh(tables = []) {
  const router = useRouter()
  const key = tables.join(',')

  useEffect(() => {
    if (!key) return
    const supabase = createClient()
    const channel = supabase.channel(`realtime-refresh-${key}`)

    let pending = null
    const scheduleRefresh = () => {
      clearTimeout(pending)
      pending = setTimeout(() => router.refresh(), 300)
    }

    key.split(',').forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleRefresh
      )
    })

    channel.subscribe()

    return () => {
      clearTimeout(pending)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
