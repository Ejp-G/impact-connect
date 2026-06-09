import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const results = {}

  try {
    // 1. Mettre à jour alertes et scores
    await supabase.rpc('update_alerts_and_scores')
    results.alerts = 'OK'

    // 2. Créer tâches pour les relances dues aujourd'hui
    const { data: dueTasks } = await supabase.from('tasks')
      .select('id,contact_id,assigned_to,type,title')
      .eq('status', 'pending').eq('due_date', today)

    // Notifier chaque agent de ses tâches du jour
    const agentTasks = {}
    dueTasks?.forEach(t => {
      if (t.assigned_to) {
        agentTasks[t.assigned_to] = [...(agentTasks[t.assigned_to]||[]), t]
      }
    })

    const notifs = Object.entries(agentTasks).map(([userId, tasks]) => ({
      user_id: userId,
      type: 'daily_tasks',
      title: `📋 Vos actions du jour`,
      message: `Vous avez ${tasks.length} action(s) à effectuer aujourd'hui.`,
    }))

    if (notifs.length) await supabase.from('notifications').insert(notifs)
    results.notifications = notifs.length

    // 3. Archiver les dossiers mineurs expirés (J+30)
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString()
    await supabase.from('contacts').update({ status:'archived', parental_status:'expired', archived_at: new Date().toISOString() })
      .eq('is_minor', true).eq('parental_status','pending').lt('created_at', thirtyDaysAgo)
    results.mineurs = 'OK'

    // 4. Supprimer définitivement les dossiers expirés depuis +90 jours
    const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString()
    await supabase.from('contacts').update({ status:'deleted' })
      .eq('parental_status','expired').lt('archived_at', ninetyDaysAgo)
    results.deleted = 'OK'

    return NextResponse.json({ success: true, date: today, results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
