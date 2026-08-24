import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — modifie une assignation existante (dimanche : poste ; lundi : prière/phoning)
export async function PATCH(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { table, id, profile_id, custom_name } = await request.json()
  const ALLOWED_TABLES = ['planning_assignments', 'planning_prayer_assignments', 'planning_phoning_assignments']
  if (!ALLOWED_TABLES.includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

  const { error } = await supabase.from(table).update({
    profile_id: profile_id || null,
    custom_name: profile_id ? null : (custom_name || null),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
