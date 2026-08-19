// lib/push-send.js
//
// Envoi de push réutilisable depuis les crons — même mécanisme que la
// route /api/push/send existante (VAPID, nettoyage des abonnements
// expirés en 410), extrait ici pour être appelé directement sans
// aller-retour HTTP interne. La route /api/push/send existante n'est
// pas modifiée.

import webpush from 'web-push'

let configured = false
function ensureVapid() {
  if (configured) return
  webpush.setVapidDetails(
    'mailto:contact@impact-connect.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  configured = true
}

// N'échoue jamais bruyamment : les erreurs sont comptées, jamais
// propagées, pour ne pas bloquer le job global (règle §24).
export async function sendPushToUser(supabase, userId, { title, body, url, urgent }) {
  ensureVapid()
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
  if (!subs?.length) return { sent: 0, failed: 0 }

  const payload = JSON.stringify({ title, body, url: url || '/', urgent: urgent || false })
  let sent = 0, failed = 0

  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err) {
      failed++
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return { sent, failed }
}
