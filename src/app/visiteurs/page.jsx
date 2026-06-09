import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import VisiteursClient from './VisiteursClient'

export default async function VisiteursPage({ searchParams }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const stage = searchParams?.stage || null
  const alert = searchParams?.alert || null

  let query = supabase.from('contacts')
    .select(`id,first_name,last_name,sex,phone,email,commune,quartier,stage,integration_score,alert_level,is_minor,created_at,first_visit_date,
             fi:familles_impact(id,name), agent:profiles!contacts_assigned_to_fkey(id,name)`)
    .eq('status','active').order('created_at',{ascending:false}).limit(100)
  if (stage) query = query.eq('stage', stage)
  if (alert) query = query.eq('alert_level', alert)

  const { data: contacts, count } = await query

  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status','active')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active',true).order('name')

  const stats = {
    total: contacts?.length || 0,
    alerts: contacts?.filter(c => c.alert_level === 'red').length || 0,
    today: contacts?.filter(c => c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length || 0,
    mineurs: contacts?.filter(c => c.is_minor).length || 0,
  }

  return (
    <AppLayout profile={profile} pageId="visiteurs" title="Visiteurs & Contacts">
      <VisiteursClient contacts={contacts||[]} stats={stats} fis={fis||[]} communes={communes||[]} profile={profile} />
    </AppLayout>
  )
}
