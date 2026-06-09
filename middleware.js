import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Accès par rôle — 'all' = toutes les pages
const ROLE_ACCESS = {
  admin:                   'all',
  responsable_integration: ['/dashboard','/visiteurs','/pipeline','/suivi','/qrcode','/journal','/rapports','/parametres'],
  equipe_integration:      ['/visiteurs','/qrcode'],
  responsable_suivi:       ['/dashboard','/visiteurs','/suivi','/communications','/rapports'],
  equipe_suivi:            ['/visiteurs','/suivi','/communications'],
  pilote_fi:               ['/fi','/suivi','/communications','/qrcode'],
  superviseur:             ['/dashboard','/visiteurs','/fi','/rapports','/carte','/communications'],
  responsable_jeunesse:    ['/jeunesse','/visiteurs','/communications'],
}

const DEFAULT_PAGE = {
  admin:                   '/dashboard',
  responsable_integration: '/dashboard',
  equipe_integration:      '/visiteurs',
  responsable_suivi:       '/suivi',
  equipe_suivi:            '/suivi',
  pilote_fi:               '/fi',
  superviseur:             '/dashboard',
  responsable_jeunesse:    '/jeunesse',
}

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  // Cron routes — sécurisées par header secret
  if (pathname.startsWith('/api/cron')) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return response
  }

  // Routes API — auth via session
  if (pathname.startsWith('/api/')) return response

  const { data: { session } } = await supabase.auth.getSession()

  // Non connecté → /login
  if (!session && pathname !== '/login' && !pathname.startsWith('/qrcode') && !pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Déjà connecté → éviter /login
  if (session && pathname === '/login') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    const role = profile?.role || 'equipe_integration'
    return NextResponse.redirect(new URL(DEFAULT_PAGE[role] || '/dashboard', request.url))
  }

  // Vérification des droits
  if (session && pathname !== '/login') {
    const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', session.user.id).single()
    if (!profile?.active) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=inactive', request.url))
    }
    const role = profile.role
    const access = ROLE_ACCESS[role]
    if (access !== 'all' && !access?.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL(DEFAULT_PAGE[role] || '/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
