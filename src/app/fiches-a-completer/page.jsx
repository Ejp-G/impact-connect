import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import FichesACompleterClient from './FichesACompleterClient'

export default async function FichesACompleterPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  // Toutes les lignes incompletes/doublons de TOUS les lots d'import,
  // pas seulement le dernier — vue permanente, en dehors de la fenetre
  // d'import qui se referme et fait perdre la trace de ces lignes.
  const { data: rows } = await supabase.from('import_rows')
    .select('*, batch:import_batches(id,file_name,status)')
    .in('status', ['incomplete', 'duplicate'])
    .order('created_at', { ascending: false })

  return (
    <AppLayout profile={profile} pageId="fiches-a-completer" title="Fiches à compléter">
      <FichesACompleterClient rows={rows || []} />
    </AppLayout>
  )
}
