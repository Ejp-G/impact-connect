import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role,secondary_roles').eq('id', session.user.id).single()
  const authorized = profile?.role === 'admin' || profile?.role === 'responsable_suivi'
    || (profile?.secondary_roles || []).includes('responsable_suivi')
  if (!authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { ids, reason } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Aucun parcours sélectionné' }, { status: 400 })
  }
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: 'Motif requis (5 caractères minimum)' }, { status: 400 })
  }

  // CORRIGÉ : admin client pour lecture ET suppression, même raison
  // que sur la route unitaire — RLS pouvait bloquer silencieusement le
  // DELETE en laissant la commande "réussir" sans rien supprimer.
  const admin = createAdminClient()

  const { data: existingRows } = await admin
    .from('parcours_integration')
    .select('*')
    .in('id', ids)

  if (existingRows?.length) {
    await admin.from('audit_log').insert(
      existingRows.map(row => ({
        action: 'Suppression parcours inachevé (groupée)',
        entity_type: 'parcours',
        entity_id: row.id,
        performed_by: session.user.id,
        details: { reason: reason.trim(), snapshot: row },
      }))
    )
  }

  const { error, count } = await admin
    .from('parcours_integration')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deleted: count ?? existingRows?.length ?? 0 })
}
