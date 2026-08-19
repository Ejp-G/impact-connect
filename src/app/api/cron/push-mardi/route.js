import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-send'
import { getUncontactedFromSunday, guadeloupeDateString, addDays } from '@/lib/push-weekly'
import { PUSH_TYPES } from '@/lib/push-schedule'

// Chaque mardi à 19h — premier rappel : jeunes attribués dimanche
// dernier et toujours pas contactés. Silence total si tout est à jour
// (règle §6).
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const today = guadeloupeDateString()
  const sunday = addDays(today, -2)

  const uncontacted = await getUncontactedFromSunday(supabase, sunday)
  const integratorIds = Object.keys(uncontacted)
  if (!integratorIds.length) return NextResponse.json({ success: true, notified: 0 })

  const { data: profiles } = await supabase
    .from('profiles').select('id, active, integrator_pause_until').in('id', integratorIds)
  const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const results = []
  for (const integratorId of integratorIds) {
    const profile = profileById[integratorId]
    if (!profile || !profile.active) continue
    const count = uncontacted[integratorId]

    const { error: logError } = await supabase.from('push_notification_log').insert({
      user_id: integratorId, notif_type: PUSH_TYPES.MARDI, week_start: sunday, contact_count: count,
    })
    if (logError) {
      if (logError.code !== '23505') console.error('push-mardi log error', integratorId, logError)
      continue
    }

    const title = 'Rappel — jeunes à contacter'
    const message = count === 1
      ? 'Il te reste 1 jeune parmi ceux attribués dimanche à contacter. Pense à le contacter cette semaine.'
      : `Il te reste ${count} jeunes parmi ceux attribués dimanche à contacter. Pense à les contacter cette semaine.`

    await supabase.from('notifications').insert({
      user_id: integratorId, type: PUSH_TYPES.MARDI, title, message, link: '/suivi',
    })

    const paused = profile.integrator_pause_until && profile.integrator_pause_until >= today
    if (!paused) await sendPushToUser(supabase, integratorId, { title, body: message, url: '/suivi' })

    results.push({ integratorId, count, paused })
  }

  return NextResponse.json({ success: true, notified: results.length, results })
}
