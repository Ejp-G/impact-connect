import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Même garde-fou et même logique de traçabilité que DELETE sur
// /api/suivi/parcours/[id], appliqués à plusieurs ids en une requête —
// évite de cliquer un par un quand il y a beaucoup de fiches de test.
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

  const { data: existingRows } = await supabase
    .from('parcours_integration')
    .select('*')
    .in('id', ids)

  if (existingRows?.length) {
    await supabase.from('audit_log').insert(
      existingRows.map(row => ({
        action: 'Suppression parcours inachevé (groupée)',
        entity_type: 'parcours',
        entity_id: row.id,
        performed_by: session.user.id,
        details: { reason: reason.trim(), snapshot: row },
      }))
    )
  }

  const { error } = await supabase.from('parcours_integration').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deleted: existingRows?.length || 0 })
}
