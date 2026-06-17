'use client'
import { useEffect } from 'react'

// Les pages de l'application (Dashboard, Visiteurs, etc.) ont besoin que
// html/body bloquent le scroll global, car elles gerent leur propre defilement
// interne (.main-area). Mais les pages publiques (login, QR, reset password)
// sont de simples pages qui doivent pouvoir defiler normalement, surtout sur
// mobile ou le contenu est plus haut que l'ecran.
// Ce composant retire temporairement ce blocage pendant que la page publique
// est affichee, puis le restaure en quittant la page.
export default function PublicPageShell({ children }) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight:   html.style.height,
      bodyHeight:   body.style.height,
    }
    html.style.overflow = 'auto'
    body.style.overflow = 'auto'
    html.style.height = 'auto'
    body.style.height = 'auto'

    return () => {
      html.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.bodyOverflow
      html.style.height   = prev.htmlHeight
      body.style.height   = prev.bodyHeight
    }
  }, [])

  return children
}
