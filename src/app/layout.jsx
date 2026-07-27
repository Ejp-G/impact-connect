import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google'
import '@/app/globals.css'
import { createClient } from '@/lib/supabase/server'

const pjs = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300','400','500','600','700','800'],
  variable: '--font-pjs',
  display: 'swap',
})
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600','700'],
  variable: '--font-fraunces',
  display: 'swap',
})

// Nom par defaut si aucune valeur n'est trouvee en base (memes valeurs
// que DEFAULT_BRANDING dans BrandingProvider, pour rester coherent).
const DEFAULT_NAME1 = 'PRODIGES'
const DEFAULT_NAME2 = 'CONNECT'
const DEFAULT_COLOR = '#0B3D91'

// generateMetadata s'execute cote serveur a chaque requete de page,
// donc le titre d'onglet reflete toujours la derniere valeur enregistree
// dans Parametres > Marque & Design, sans dependre du contexte client.
export async function generateMetadata() {
  let name1 = DEFAULT_NAME1
  let name2 = DEFAULT_NAME2
  let color = DEFAULT_COLOR

  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'branding')
      .single()

    if (data?.value) {
      name1 = data.value.name1 || DEFAULT_NAME1
      name2 = data.value.name2 || DEFAULT_NAME2
      color = data.value.color || DEFAULT_COLOR
    }
  } catch {
    // Si la requete echoue (ex: settings pas encore initialise),
    // on retombe silencieusement sur les valeurs par defaut.
  }

  const brandName = [name1, name2].filter(Boolean).join(' ')

  return {
    title: brandName,
    description: "Plateforme CRM d'intégration pour église",
    manifest: '/manifest.json',
    themeColor: color,
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: brandName },
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${pjs.variable} ${fraunces.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ fontFamily: 'var(--font-pjs), sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
