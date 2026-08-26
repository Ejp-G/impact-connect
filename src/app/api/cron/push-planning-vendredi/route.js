import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-send'
import { getSundayAssignments, nextSundayFrom, formatFr } from '@/lib/planning-notify'
import { guadeloupeDateString } from '@/lib/push-weekly'
import { PUSH_TYPES } from '@/lib/push-schedule'

// Chaque vendredi après-midi — dernier rappel avant le dimanche.
// Concerne UNIQUEMENT le service du dimanche à venir. Une personne
// qui fait seulement la prière du lundi suivant (sans servir dimanche)
// ne reçoit rien ici — elle sera prévenue le lundi matin.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const today = guadeloupeDateString()
  const upcomingSunday = nextSundayFrom(today)
  const sundayPosts = await getSundayAssignments(supabase, upcomingSunday)

  const results = []
  for (const [profileId, posts] of Object.entries(sundayPosts)) {
    if (!posts.length) continue
    const { error: logError } = await supabase.from('push_notification_log').insert({
      user_id: profileId, notif_type: PUSH_TYPES.PLANNING_VENDREDI, week_start: upcomingSunday,
    })
    if (logError) {
      if (logError.code !== '23505') console.error('push-planning-vendredi log error', profileId, logError)
      continue
    }

    const { data: profile } = await supabase.from('profiles').select('active').eq('id', profileId).single()
    if (!profile?.active) continue

    const title = 'Rappel — tu es en service ce dimanche'
    const message = `Tu es de service dimanche ${formatFr(upcomingSunday)} : ${posts.join(', ')}.`

    await supabase.from('notifications').insert({
      user_id: profileId, type: PUSH_TYPES.PLANNING_VENDREDI, title, message, link: '/planning',
    })
    await sendPushToUser(supabase, profileId, { title, body: message, url: '/planning' })
    results.push({ profileId, message })
  }

  return NextResponse.json({ success: true, notified: results.length, upcomingSunday })
}
