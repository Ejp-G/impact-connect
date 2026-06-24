import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google'
import '@/app/globals.css'

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

export const metadata = {
  title: 'Impact Connect',
  description: "Plateforme CRM d'intégration pour église",
  manifest: '/manifest.json',
  themeColor: '#0B3D91',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Impact Connect' },
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
