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

// NOUVEAU : suppression définitive d'un parcours inachevé — même
// garde-fou que PATCH (requireResponsableSuivi). Le snapshot complet
// (form_data compris) est archivé dans audit_log AVANT suppression,
// pour garder une trace de ce qui a été supprimé et pourquoi.
export async function DELETE(request, { params }) {
  const supabase = createClient()
  const auth = await requireResponsableSuivi(supabase)
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { reason } = await request.json()
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: 'Motif requis (5 caractères minimum)' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('parcours_integration')
    .select('*')
    .eq('id', params.id)
    .single()
  if (fetchError || !existing) return NextResponse.json({ error: 'Parcours introuvable' }, { status: 404 })

  await supabase.from('audit_log').insert({
    action: 'Suppression parcours inachevé',
    entity_type: 'parcours',
    entity_id: params.id,
    performed_by: auth.session.user.id,
    details: { reason: reason.trim(), snapshot: existing },
  })

  const { error } = await supabase.from('parcours_integration').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
