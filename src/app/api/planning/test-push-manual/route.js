import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push-send'

// Route de TEST temporaire — envoie un push directement à l'admin
// connecté, pour vérifier la livraison réelle sur son téléphone,
// indépendamment de toute donnée d'attribution. À supprimer une fois
// le diagnostic terminé.
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin uniquement' }, { status: 403 })

  const result = await sendPushToUser(supabase, session.user.id, {
    title: 'Test Impact Connect',
    body: 'Si tu vois cette notification, le système fonctionne !',
    url: '/planning',
  })

  return NextResponse.json(result)
}
