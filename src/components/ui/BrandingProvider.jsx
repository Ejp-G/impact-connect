'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { applyBrandingToDOM } from '@/lib/theme'

const DEFAULT_BRANDING = {
  name1:'IMPACT', name2:'CONNECT', icon:'cross', color:'#0B3D91',
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

  useEffect(() => {
    applyBrandingToDOM(branding)
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
