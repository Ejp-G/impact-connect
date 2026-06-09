import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import RapportsClient from './RapportsClient'
export default async function RapportsPage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()

  const [{ count: totalActive }, { count: monthNew }, { count: salvations },
         { count: baptisms }, { count: integrated }, { data: byStage }] = await Promise.all([
    supabase.from('contacts').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('contacts').select('*',{count:'exact',head:true}).eq('status','active').gte('created_at',startOfMonth),
    supabase.from('contacts').select('*',{count:'exact',head:true}).eq('salvation_call',true).gte('created_at',startOfYear),
    supabase.from('contacts').select('*',{count:'exact',head:true}).eq('stage','bapteme').eq('status','active'),
    supabase.from('contacts').select('*',{count:'exact',head:true}).in('stage',['integre','parcours','bapteme','service','leader_pot','leader']).eq('status','active'),
    supabase.from('contacts').select('stage').eq('status','active'),
  ])
  const stageCounts = {}
  byStage?.forEach(c=>{ stageCounts[c.stage]=(stageCounts[c.stage]||0)+1 })
  const stats = { totalActive, monthNew, salvations, baptisms, integrated, stageCounts }
  return <AppLayout profile={profile} pageId="rapports" title="Rapports & Statistiques"><RapportsClient stats={stats} /></AppLayout>
}
