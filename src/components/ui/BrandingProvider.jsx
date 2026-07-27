'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { applyBrandingToDOM } from '@/lib/theme'

// Valeurs de secours utilisees uniquement si Supabase n'a pas encore
// repondu OU si la ligne 'branding' n'existe pas en base. Doivent rester
// coherentes avec les defauts utilises dans generateMetadata (app/layout.jsx).
const DEFAULT_BRANDING = {
  name1:'PRODIGES', name2:'CONNECT', icon:'croix', color:'#0B3D91',
  colorSecondary:'#1452B5', gradientEnabled:false, gradientType:'linear',
  gradientAngle:135, customLogoUrl:null,
}

const BrandingContext = createContext(DEFAULT_BRANDING)

// Hook utilise partout dans l'app pour lire la marque actuelle
// (logo, nom, couleurs) sans avoir a la faire transiter page par page.
export function useBranding() {
  return useContext(BrandingContext)
}

export default function BrandingProvider({ initialBranding, children }) {
  const [branding, setBranding] = useState({ ...DEFAULT_BRANDING, ...(initialBranding || {}) })
  const supabase = createClient()

  // Resynchronise le state (et le DOM) si initialBranding change entre
  // deux rendus du parent, par exemple apres une navigation qui refetch
  // les settings cote serveur. Sans ce garde-fou, la valeur passee en
  // prop au tout premier rendu restait figee pour toute la session.
  useEffect(() => {
    if (initialBranding) {
      const next = { ...DEFAULT_BRANDING, ...initialBranding }
      setBranding(next)
      applyBrandingToDOM(next)
    }
  }, [initialBranding])

  useEffect(() => {
    applyBrandingToDOM(branding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lecture initiale directe de la table settings au montage. Sans ca,
  // le contexte n'affiche les vraies valeurs que si quelqu'un modifie
  // les parametres PENDANT que cette page est ouverte (le canal Realtime
  // ci-dessous n'ecoute que les evenements UPDATE, jamais l'etat courant).
  // C'etait la cause du bug "changer le nom ne change presque rien" :
  // BrandingProvider n'etait meme pas monte dans AppLayout, donc ni cette
  // lecture ni le Realtime n'avaient de chance de s'executer.
  useEffect(() => {
    if (initialBranding) return
    let cancelled = false
    async function fetchInitialBranding() {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'branding')
        .single()
      if (!cancelled && !error && data?.value) {
        const next = { ...DEFAULT_BRANDING, ...data.value }
        setBranding(next)
        applyBrandingToDOM(next)
      }
    }
    fetchInitialBranding()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('branding-live')
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'settings', filter:'key=eq.branding' },
        (payload) => {
          if (payload.new?.value) {
            const next = { ...DEFAULT_BRANDING, ...payload.new.value }
            setBranding(next)
            applyBrandingToDOM(next)
          }
        }
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}
