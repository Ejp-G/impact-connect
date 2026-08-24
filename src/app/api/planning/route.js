import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generatePlanningAssignments } from '@/lib/planning-assign'

const ALLOWED_ROLES = ['admin', 'responsable_suivi', 'responsable_integration']

// GET /api/planning?month=2026-09-01 — récupère le planning complet du mois
export async function GET(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month requis' }, { status: 400 })

  const { data: planning } = await supabase.from('plannings').select('*').eq('month', month).maybeSingle()
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

  return NextResponse.json({ planning, sundays: sundays || [], mondays: mondays || [] })
}

// POST /api/planning — crée + génère automatiquement un planning pour un mois
export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!ALLOWED_ROLES.includes(profile?.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { month, title } = await request.json()
  if (!month) return NextResponse.json({ error: 'month requis' }, { status: 400 })

  const admin = createAdminClient()

  // Régénération : si un planning existe déjà pour ce mois, on le
  // supprime (cascade) et on recrée — évite les doublons de dimanches.
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
