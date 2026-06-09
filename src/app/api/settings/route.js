import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export async function PATCH(request) {
  const supabase = createClient()
  const { key, value } = await request.json()
  const { error } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
export async function GET() {
  const supabase = createClient()
  const { data } = await supabase.from('settings').select('*')
  const settings = {}
  data?.forEach(r => { settings[r.key] = r.value })
  return NextResponse.json({ data: settings })
}
