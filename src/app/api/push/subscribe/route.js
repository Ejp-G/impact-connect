import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

  const { endpoint, keys } = await request.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id:    session.user.id,
    endpoint,
    p256dh:     keys.p256dh,
    auth:       keys.auth,
  }, { onConflict: 'user_id,endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

  const { endpoint } = await request.json()
  await supabase.from('push_subscriptions').delete()
    .eq('user_id', session.user.id).eq('endpoint', endpoint)
  return NextResponse.json({ success: true })
}
