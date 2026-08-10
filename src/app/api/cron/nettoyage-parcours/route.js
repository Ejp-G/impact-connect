import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Supprime les parcours non finalisés et inactifs depuis plus de 90 jours
// (politique de conservation RGPD). Les parcours finalisés (contact_id
// renseigné) ne sont jamais concernés : ils vivent désormais dans la
// table contacts, avec ses propres règles de conservation.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()

  const { data: toDelete } = await supabase
    .from('parcours_integration')
    .select('id')
    .is('contact_id', null)
    .lt('last_activity_at', cutoff)

  if (toDelete?.length) {
    await supabase.from('parcours_integration').delete().in('id', toDelete.map(p => p.id))
    await supabase.from('audit_log').insert({
      action: 'Nettoyage RGPD parcours abandonnés',
      entity_type: 'parcours',
      details: { count: toDelete.length, cutoff }
    })
  }

  return NextResponse.json({ success: true, deleted: toDelete?.length || 0 })
}
