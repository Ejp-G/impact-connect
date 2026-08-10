import { createAdminClient } from '@/lib/supabase/server'
import QRFormClient from './QRFormClient'

// Page publique : createAdminClient obligatoire, pas de session ici.
export default async function QRFormPage() {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['integrateur', 'equipe_accueil'])
    .order('name')

  return <QRFormClient welcomeTeam={profiles || []} />
}
