import { createClient } from '@/lib/supabase/server'

export default async function manifest() {
  let branding = null
  try {
    const supabase = createClient()
    const { data } = await supabase.from('settings').select('value').eq('key', 'branding').single()
    branding = data?.value
  } catch {}

  const name1 = branding?.name1 || 'IMPACT'
  const name2 = branding?.name2 || 'CONNECT'

  return {
    name: `${name1} ${name2}`.trim(),
    short_name: name1,
    description: "Plateforme CRM d'intégration pour église",
    start_url: '/',
    display: 'standalone',
    background_color: '#072B6A',
    theme_color: branding?.color || '#0B3D91',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}
