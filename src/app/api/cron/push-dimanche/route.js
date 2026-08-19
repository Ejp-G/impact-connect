import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-send'
import { getAssignmentsForDay, getUncontactedFromSunday, guadeloupeDateString, addDays } from '@/lib/push-weekly'
import { PUSH_TYPES } from '@/lib/push-schedule'

// Chaque dimanche à 19h — notifie chaque intégrateur des nouveaux
// jeunes qui viennent de lui être attribués aujourd'hui, et signale
// s'il reste des jeunes non contactés de l'attribution du dimanche
// précédent (règle §9 : un jeune ne doit jamais être oublié
// simplement parce qu'une nouvelle semaine commence).
//
// "Intégrateur" = présent dans contact_integrators, pas un rôle figé
// (cf. also_integrator sur profiles) — donc on cible par présence
// réelle dans les attributions, jamais par rôle fixe (règle §18).
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const today = guadeloupeDateString()
  const lastSunday = addDays(today, -7)

  const [assignments, leftovers] = await Promise.all([
    getAssignmentsForDay(supabase, today),
    getUncontactedFromSunday(supabase, lastSunday),
  ])

  const integratorIds = [...new Set([...Object.keys(assignments), ...Object.keys(leftovers)])]
  if (!integratorIds.length) return NextResponse.json({ success: true, notified: 0 })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, active, integrator_pause_until')
    .in('id', integratorIds)
  const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const results = []
  for (const integratorId of integratorIds) {
    const profile = profileById[integratorId]
    if (!profile || !profile.active) continue

    const newCount = assignments[integratorId]?.count || 0
    const leftoverCount = leftovers[integratorId] || 0
    if (!newCount && !leftoverCount) continue

    const { error: logError } = await supabase.from('push_notification_log').insert({
      user_id: integratorId,
      notif_type: PUSH_TYPES.DIMANCHE,
      week_start: today,
      contact_count: newCount,
    })
    if (logError) {
      if (logError.code !== '23505') console.error('push-dimanche log error', integratorId, logError)
      continue // 23505 = déjà envoyé cette semaine (job relancé) : anti-doublon
    }

    let title, message
    if (newCount === 1) {
      title = 'Nouveau jeune attribué'
      message = "1 nouveau jeune t'est attribué aujourd'hui. Pense à le contacter cette semaine."
    } else if (newCount > 1) {
      title = 'Nouveaux jeunes attribués'
      message = `${newCount} nouveaux jeunes te sont attribués aujourd'hui. Pense à les contacter cette semaine.`
    } else {
      title = 'À terminer'
      message = ''
    }
    if (leftoverCount > 0) {
      message += (message ? ' ' : '') +
        `⚠️ À terminer : ${leftoverCount} jeune${leftoverCount > 1 ? 's' : ''} de la semaine dernière n'${leftoverCount > 1 ? 'ont' : 'a'} toujours pas été contacté${leftoverCount > 1 ? 's' : ''}.`
    }

    await supabase.from('notifications').insert({
      user_id: integratorId, type: PUSH_TYPES.DIMANCHE, title, message, link: '/suivi',
    })

    const paused = profile.integrator_pause_until && profile.integrator_pause_until >= today
    if (!paused) await sendPushToUser(supabase, integratorId, { title, body: message, url: '/suivi' })

    results.push({ integratorId, newCount, leftoverCount, paused })
  }

  return NextResponse.json({ success: true, notified: results.length, results })
}
