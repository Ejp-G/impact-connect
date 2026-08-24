import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { name, emoji, default_slots, sort_order } = await request.json()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  const { error } = await supabase.from('planning_post_types').insert({
    name, emoji: emoji || null, default_slots: default_slots || 1,
    sort_order: sort_order || 99, created_by: session.user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, active } = await request.json()
  const { error } = await supabase.from('planning_post_types').update({ active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
