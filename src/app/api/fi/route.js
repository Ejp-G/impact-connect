import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from('familles_impact')
    .select(`*, pilot:profiles!familles_impact_pilot_id_fkey(id,name), copilot:profiles!familles_impact_copilot_id_fkey(id,name),
             commune:communes(id,name,sector),
             member_count:contacts(count)`)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request) {
  const supabase = createClient()
  const body = await request.json()
  const { data, error } = await supabase.from('familles_impact').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
