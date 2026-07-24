import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import FIClient from './FIClient'

export default async function FIPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const { data: fis } = await supabase.from('familles_impact')
    .select('*,pilot:profiles!familles_impact_pilot_id_fkey(id,name),copilot:profiles!familles_impact_copilot_id_fkey(id,name),members:contacts(count)')
    .order('name')

  const { data: profiles } = await supabase.from('profiles').select('id,name,role').order('name')
  const { data: communes } = await supabase.from('communes').select('id,name,island').eq('active', true).order('name')

  const enriched = fis?.map(fi => ({ ...fi, memberCount: fi.members?.[0]?.count || 0 })) || []

  return (
    <AppLayout profile={profile} pageId="fi" title="Familles d'Impact">
      <FIClient fis={enriched} profile={profile} profiles={profiles || []} communes={communes || []} />
    </AppLayout>
  )
}
