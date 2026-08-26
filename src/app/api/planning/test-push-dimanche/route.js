import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Route de TEST temporaire — réservée aux admins, ne nécessite pas
// CRON_SECRET (elle le lit elle-même côté serveur). Permet de tester
// le cron push-dimanche sans avoir à retrouver la valeur de
// CRON_SECRET. À supprimer une fois le diagnostic terminé.
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin uniquement' }, { status: 403 })

  const res = await fetch('https://impact-connect-seven.vercel.app/api/cron/push-dimanche', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
  })
  const data = await res.json()
  return NextResponse.json(data)
}
