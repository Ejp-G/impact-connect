import { createAdminClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { NextResponse } from 'next/server'

webpush.setVapidDetails(
  'mailto:contact@impact-connect.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  const supabase = createAdminClient()
  const { userIds, title, body, url, urgent } = await request.json()

  if (!userIds?.length || !title) {
    return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
  }

  // Récupérer tous les abonnements des utilisateurs ciblés
  const { data: subs } = await supabase.from('push_subscriptions')
    .select('*').in('user_id', userIds)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({ title, body, url: url || '/', urgent: urgent || false })
  const results = { sent: 0, failed: 0 }

  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      results.sent++
    } catch (err) {
      results.failed++
      // Supprimer les abonnements expirés
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return NextResponse.json(results)
}
