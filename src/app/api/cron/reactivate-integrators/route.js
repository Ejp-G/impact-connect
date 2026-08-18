import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// =========================================================
// RÉACTIVATION AUTOMATIQUE DES INTÉGRATEURS EN PAUSE
// =========================================================
// Repasse en_service tout profil dont la pause était programmée
// jusqu'à une date désormais dépassée. C'est une VRAIE écriture sur
// profiles.integrator_status — pas un calcul à la volée dans les
// requêtes d'assignation — pour que la bascule soit visible de
// manière identique partout (tableau Utilisateurs, sélecteurs
// manuels, assignation auto) sans dupliquer une logique de date à
// chaque endroit qui lit ce champ.
// =========================================================

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  const today = new Date().toISOString().slice(0, 10)

  const { data: reactivated, error } = await supabase
    .from('profiles')
    .update({ integrator_status: 'en_service', integrator_pause_until: null })
    .eq('integrator_status', 'en_pause')
    .not('integrator_pause_until', 'is', null)
    .lt('integrator_pause_until', today)
    .select('id, name')

  if (error) {
    console.error('Erreur réactivation intégrateurs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Traçabilité, même pattern que les autres crons/routes d'assignation.
  if (reactivated?.length) {
    await supabase.from('audit_log').insert(
      reactivated.map(p => ({
        action: 'Réactivation automatique (fin de pause programmée)',
        entity_type: 'profile',
        entity_id: p.id,
        details: { name: p.name },
      }))
    )
  }

  return NextResponse.json({ success: true, reactivated: reactivated?.length || 0 })
}
