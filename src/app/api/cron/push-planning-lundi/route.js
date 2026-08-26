import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-send'
import { getSundayAssignments, getMondayAssignments, nextSundayFrom, formatFr } from '@/lib/planning-notify'
import { guadeloupeDateString } from '@/lib/push-weekly'
import { PUSH_TYPES } from '@/lib/push-schedule'

// Chaque lundi matin — combine :
// 1. La prière/phoning de CE lundi (lié au dimanche d'hier)
// 2. Le service du dimanche À VENIR (dans 6 jours)
// Une seule notification si l'une ou l'autre (ou les deux) s'applique.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const today = guadeloupeDateString()
  const upcomingSunday = nextSundayFrom(today)

  const [sundayPosts, mondayToday] = await Promise.all([
    getSundayAssignments(supabase, upcomingSunday),
    getMondayAssignments(supabase, today),
  ])

  const profileIds = new Set([...Object.keys(sundayPosts), ...Object.keys(mondayToday)])
  const results = []

  for (const profileId of profileIds) {
    const { error: logError } = await supabase.from('push_notification_log').insert({
      user_id: profileId, notif_type: PUSH_TYPES.PLANNING_LUNDI, week_start: today,
    })
    if (logError) {
      if (logError.code !== '23505') console.error('push-planning-lundi log error', profileId, logError)
      continue
    }

    const { data: profile } = await supabase.from('profiles').select('active').eq('id', profileId).single()
    if (!profile?.active) continue

    const posts = sundayPosts[profileId]
    const monday = mondayToday[profileId]
    const parts = []
    if (posts?.length) parts.push(`Tu es de service dimanche ${formatFr(upcomingSunday)} : ${posts.join(', ')}.`)
    if (monday?.prayer) parts.push(`Tu conduis la prière ce soir (${monday.prayer.duration}min).`)
    if (monday?.phoning) parts.push(`Tu es en charge du phoning ce soir.`)
    if (!parts.length) continue

    const hasSunday = !!posts?.length
    const hasTonight = !!(monday?.prayer || monday?.phoning)
    const title = hasSunday && hasTonight
      ? 'Service dimanche + prière ce soir'
      : hasTonight ? 'Tu conduis la prière ce soir' : 'Tu es en service ce dimanche'
    const message = parts.join(' ')

    await supabase.from('notifications').insert({
      user_id: profileId, type: PUSH_TYPES.PLANNING_LUNDI, title, message, link: '/planning',
    })
    await sendPushToUser(supabase, profileId, { title, body: message, url: '/planning' })
    results.push({ profileId, message })
  }

  return NextResponse.json({ success: true, notified: results.length, upcomingSunday, today })
}
