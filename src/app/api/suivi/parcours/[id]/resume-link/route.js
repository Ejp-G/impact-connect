import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role,secondary_roles').eq('id', session.user.id).single()
  const authorized = profile?.role === 'admin' || profile?.role === 'responsable_suivi'
    || (profile?.secondary_roles || []).includes('responsable_suivi')
  if (!authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: parcours } = await supabase
    .from('parcours_integration')
    .select('id, token, contact_id')
    .eq('id', params.id)
    .single()

  if (!parcours) return NextResponse.json({ error: 'Parcours introuvable' }, { status: 404 })
  if (parcours.contact_id) return NextResponse.json({ error: 'Ce parcours est déjà finalisé' }, { status: 409 })

  await supabase.from('audit_log').insert({
    action: 'Lien de reprise généré',
    entity_type: 'parcours',
    entity_id: parcours.id,
    performed_by: session.user.id,
  })

  return NextResponse.json({ token: parcours.token })
}
