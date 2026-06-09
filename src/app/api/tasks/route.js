import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role,id').eq('id', session.user.id).single()
  const { searchParams } = new URL(request.url)
  const today = new Date().toISOString().split('T')[0]

  let query = supabase.from('tasks')
    .select(`*, contact:contacts(id,first_name,last_name,sex,commune), assignee:profiles!tasks_assigned_to_fkey(id,name)`)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })

  if (!['admin','responsable_suivi','responsable_integration'].includes(profile?.role)) {
    query = query.eq('assigned_to', session.user.id)
  }

  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request) {
  const supabase = createClient()
  const body = await request.json()
  const { data, error } = await supabase.from('tasks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request) {
  const supabase = createClient()
  const { id, ...updates } = await request.json()
  if (updates.status === 'done') updates.done_at = new Date().toISOString()
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
