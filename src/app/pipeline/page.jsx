import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PipelineClient from './PipelineClient'
export default async function PipelinePage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: contacts } = await supabase.from('contacts')
    .select('id,first_name,last_name,sex,commune,stage,integration_score,alert_level,fi:familles_impact(name),agent:profiles!contacts_assigned_to_fkey(name)')
    .eq('status','active').order('integration_score',{ascending:false})
  return <AppLayout profile={profile} pageId="pipeline" title="Pipeline d'Intégration"><PipelineClient contacts={contacts||[]} /></AppLayout>
}
