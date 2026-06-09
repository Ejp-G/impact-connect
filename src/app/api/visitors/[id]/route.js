import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req, { params }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('contacts')
    .select(`*, fi:familles_impact(id,name,day,time,pilot_id), agent:profiles!contacts_assigned_to_fkey(id,name,sex),
             tasks(id,type,title,status,priority,due_date,done_at),
             fi_attendance(id,date,present,fi_id)`)
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req, { params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('contacts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req, { params }) {
  const supabase = createClient()
  const { error } = await supabase.from('contacts')
    .update({ status: 'deleted' }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
