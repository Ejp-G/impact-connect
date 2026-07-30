import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Archive mensuelle automatique. Tourne quotidiennement (contrainte
// Vercel Hobby : pas de cron mensuel natif), mais n'agit reellement
// que le 1er jour du mois — archive alors le mois PRECEDENT, qui est
// definitivement termine et ne bougera plus.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  if (now.getDate() !== 1) {
    return NextResponse.json({ skipped: true, reason: 'Pas le 1er du mois' })
  }

  const supabase = createAdminClient()
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year = prevMonthDate.getFullYear()
  const month = prevMonthDate.getMonth() + 1 // 1-12
  const start = prevMonthDate.toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [{ count: visitorsCount }, { count: integrationsCount }, { count: salvationsCount }, { data: cultesRows }] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('first_visit_date', start).lt('first_visit_date', end),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).not('integrated_at', 'is', null).gte('integrated_at', start).lt('integrated_at', end),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('salvation_call', true).gte('first_visit_date', start).lt('first_visit_date', end),
    supabase.from('cultes').select('nouveaux_comptes').gte('date', start).lt('date', end),
  ])
  const accueilCount = (cultesRows || []).reduce((sum, r) => sum + (r.nouveaux_comptes || 0), 0)

  const { error } = await supabase.from('monthly_stats').upsert({
    year, month,
    visitors_count: visitorsCount || 0,
    integrations_count: integrationsCount || 0,
    salvations_count: salvationsCount || 0,
    accueil_count: accueilCount,
  }, { onConflict: 'year,month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, year, month, visitorsCount, integrationsCount, salvationsCount, accueilCount })
}
