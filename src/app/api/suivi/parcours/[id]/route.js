import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Verrou serveur redondant avec la RLS : meme si la policy protege deja
// la table, on rejette explicitement ici pour renvoyer un message clair
// plutot qu'un echec silencieux de la policy.
async function requireResponsableSuivi(supabase) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, status: 401 }
  const { data: profile } = await supabase.from('profiles').select('role,secondary_roles').eq('id', session.user.id).single()
  const authorized = profile?.role === 'admin' || profile?.role === 'responsable_suivi'
    || (profile?.secondary_roles || []).includes('responsable_suivi')
  if (!authorized) return { ok: false, status: 403 }
  return { ok: true, session }
}

export async function PATCH(request, { params }) {
  const supabase = createClient()
  const auth = await requireResponsableSuivi(supabase)
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { toRelaunch } = await request.json()

  const { error } = await supabase
    .from('parcours_integration')
    .update({ to_relaunch: !!toRelaunch })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    action: toRelaunch ? 'Parcours marqué à relancer' : 'Parcours retiré des relances',
    entity_type: 'parcours',
    entity_id: params.id,
    performed_by: auth.session.user.id,
  })

  return NextResponse.json({ success: true })
}
