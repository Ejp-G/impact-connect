import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generatePlanningAssignments } from '@/lib/planning-assign'

const ALLOWED_ROLES = ['admin', 'responsable_suivi', 'responsable_integration']

export async function GET(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month requis' }, { status: 400 })

  const { data: planning } = await supabase.from('plannings')
    .select('*, validator:profiles!plannings_validated_by_fkey(name)')
    .eq('month', month).maybeSingle()
  if (!planning) return NextResponse.json({ planning: null })

  const { data: sundays } = await supabase.from('planning_sundays')
    .select('*, assignments:planning_assignments(*, post_type:planning_post_types(*), profile:profiles(id,name))')
    .eq('planning_id', planning.id).order('date')

  const { data: mondays } = await supabase.from('planning_mondays')
    .select(`
      *,
      prayer:planning_prayer_assignments(*, profile:profiles(id,name)),
      phoning:planning_phoning_assignments(*, profile:profiles(id,name))
    `)
    .eq('planning_id', planning.id).order('date')

  // Nombre total de modifications tracées, et s'il y en a eu APRÈS la
  // validation (pour prévenir que le planning validé a bougé depuis).
  const { count: totalChanges } = await supabase.from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', 'planning').eq('entity_id', planning.id)

  let modifiedAfterValidation = false
  if (planning.validated_at) {
    const { count: afterCount } = await supabase.from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type', 'planning').eq('entity_id', planning.id)
      .gt('created_at', planning.validated_at)
      .neq('action', 'Planning validé')
    modifiedAfterValidation = (afterCount || 0) > 0
  }

  return NextResponse.json({
    planning, sundays: sundays || [], mondays: mondays || [],
    totalChanges: totalChanges || 0, modifiedAfterValidation,
  })
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!ALLOWED_ROLES.includes(profile?.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { month, title } = await request.json()
  if (!month) return NextResponse.json({ error: 'month requis' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin.from('plannings').select('id').eq('month', month).maybeSingle()
  if (existing) {
    await admin.from('plannings').delete().eq('id', existing.id)
  }

  const { data: planning, error } = await admin.from('plannings').insert({
    month, title, created_by: session.user.id, status: 'draft',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await generatePlanningAssignments(admin, planning.id, month)

  await admin.from('audit_log').insert({
    action: 'Génération planning Accueil & Intégration',
    entity_type: 'planning', entity_id: planning.id,
    performed_by: session.user.id, details: { month },
  })

  return NextResponse.json({ success: true, planningId: planning.id })
}
