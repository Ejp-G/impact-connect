// Eclaircit ou fonce une couleur hex d'un pourcentage donne
// (-100 = noir complet, +100 = blanc complet)
export function adjustColor(hex, percent) {
  let h = (hex || '#0B3D91').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const num = parseInt(h, 16)
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255
  const amt = Math.round(2.55 * percent)
  r = Math.min(255, Math.max(0, r + amt))
  g = Math.min(255, Math.max(0, g + amt))
  b = Math.min(255, Math.max(0, b + amt))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// Construit la valeur CSS background (degrade ou couleur unie) a partir
// des reglages de marque. Si aucun degrade n'est active, on reconstruit
// automatiquement le rendu d'origine (bleu marine en degrade subtil)
// a partir de la seule couleur principale, pour que tout reste coherent
// meme sans personnalisation.
export function buildSurface(branding) {
  const primary = branding?.color || '#0B3D91'
  const secondary = branding?.colorSecondary || adjustColor(primary, 25)

  if (branding?.gradientEnabled) {
    if (branding.gradientType === 'radial') {
      return `radial-gradient(circle, ${primary} 0%, ${secondary} 100%)`
    }
    const angle = branding.gradientAngle || 135
    return `linear-gradient(${angle}deg, ${primary} 0%, ${secondary} 100%)`
  }

  const dark  = adjustColor(primary, -35)
  const light = adjustColor(primary, 20)
  return `linear-gradient(145deg, ${dark} 0%, ${primary} 60%, ${light} 100%)`
}

// Applique l'ensemble des variables CSS de marque sur la racine du document.
// Appele au chargement et a chaque changement en temps reel (Supabase Realtime).
export function applyBrandingToDOM(branding) {
  if (typeof document === 'undefined' || !branding) return
  const root = document.documentElement
  const primary = branding.color || '#0B3D91'

  root.style.setProperty('--n', primary)
  root.style.setProperty('--nd', adjustColor(primary, -35))
  root.style.setProperty('--nl', adjustColor(primary, 20))
  root.style.setProperty('--n2', branding.colorSecondary || adjustColor(primary, 25))
  root.style.setProperty('--brand-surface', buildSurface(branding))

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', primary)
}
