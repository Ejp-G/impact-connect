import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PlanningClient from './PlanningClient'

export default async function PlanningPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const { data: postTypes } = await supabase.from('planning_post_types')
    .select('*').eq('active', true).order('sort_order')
  const { data: allProfiles } = await supabase.from('profiles')
    .select('id,name,role,secondary_roles,integrator_status,active').eq('active', true).order('name')

  return (
    <AppLayout profile={profile} pageId="planning" title="Planning Accueil & Intégration">
      <PlanningClient profile={profile} postTypes={postTypes || []} allProfiles={allProfiles || []} />
    </AppLayout>
  )
}
