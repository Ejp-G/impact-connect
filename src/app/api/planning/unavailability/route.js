import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  const { data } = await supabase.from('planning_unavailability')
    .select('*, profile:profiles(id,name)').eq('month', month)
  return NextResponse.json({ unavailability: data || [] })
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { profile_id, month, reason } = await request.json()
  const { error } = await supabase.from('planning_unavailability')
    .upsert({ profile_id, month, reason }, { onConflict: 'profile_id,month' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await request.json()
  await supabase.from('planning_unavailability').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
