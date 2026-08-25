import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['admin', 'responsable_suivi', 'responsable_integration']

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role,name').eq('id', session.user.id).single()
  if (!ALLOWED_ROLES.includes(profile?.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { planningId } = await request.json()
  if (!planningId) return NextResponse.json({ error: 'planningId requis' }, { status: 400 })

  const { error } = await supabase.from('plannings').update({
    status: 'published',
    validated_by: session.user.id,
    validated_at: new Date().toISOString(),
  }).eq('id', planningId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    action: 'Planning validé',
    entity_type: 'planning',
    entity_id: planningId,
    performed_by: session.user.id,
    details: { validateur: profile.name },
  })

  return NextResponse.json({ success: true })
}
