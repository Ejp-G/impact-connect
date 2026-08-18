import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

// CORRIGÉ : l'autorisation reste vérifiée via le client normal
// (requireResponsableSuivi, avec RLS), mais la lecture + suppression
// réelles passent désormais par createAdminClient() — sans ça, si la
// table parcours_integration n'a pas de policy RLS "DELETE" pour ce
// rôle, la commande "réussissait" sans erreur mais supprimait 0 ligne,
// laissant la fiche visible après rechargement.
export async function DELETE(request, { params }) {
  const supabase = createClient()
  const auth = await requireResponsableSuivi(supabase)
  if (!auth.ok) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const { reason } = await request.json()
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: 'Motif requis (5 caractères minimum)' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('parcours_integration')
    .select('*')
    .eq('id', params.id)
    .single()
  if (fetchError || !existing) return NextResponse.json({ error: 'Parcours introuvable' }, { status: 404 })

  await admin.from('audit_log').insert({
    action: 'Suppression parcours inachevé',
    entity_type: 'parcours',
    entity_id: params.id,
    performed_by: auth.session.user.id,
    details: { reason: reason.trim(), snapshot: existing },
  })

  const { error, count } = await admin
    .from('parcours_integration')
    .delete({ count: 'exact' })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: "La suppression n'a affecté aucune ligne — vérifiez les droits RLS sur parcours_integration." }, { status: 500 })

  return NextResponse.json({ success: true })
}
