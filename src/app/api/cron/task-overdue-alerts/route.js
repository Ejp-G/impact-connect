import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// =========================================================
// GARDE-FOU DES TACHES EN RETARD
// =========================================================
// Philosophie : silencieux quand tout va bien, une seule alerte par
// tache en retard (jamais de recapitulatif quotidien, jamais de
// doublon). Concu pour accueillir facilement d'autres types d'alertes
// plus tard : ajouter un nouveau garde-fou = une nouvelle fonction
// independante dans ce meme fichier, sans toucher a celle-ci.
// =========================================================

function emailWrapper(bodyHtml) {
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display:inline-block;background:#0B3D91;color:#fff;font-size:18px;font-weight:800;padding:10px 20px;border-radius:12px;">Impact Connect</div>
      </div>
      ${bodyHtml}
      <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:24px;text-align:center;color:#94A3B8;font-size:12px;">Impact Connect</div>
    </div>
  `
}

function daysLate(dueDate) {
  const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
  return Math.max(1, diff)
}

// Garde-fou n°1 : taches de suivi en retard, non encore signalees.
async function checkOverdueTasks(supabase) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: overdueTasks } = await supabase.from('tasks')
    .select('id,title,type,due_date,contact:contacts(first_name,last_name),assignee:profiles!tasks_assigned_to_fkey(name)')
    .eq('status', 'pending')
    .eq('overdue_alert_sent', false)
    .lt('due_date', today)

  if (!overdueTasks?.length) return { checked: 'overdue_tasks', alertsSent: 0 }

  // Destinataires : superviseurs + responsables Suivi & Integration
  // (role principal OU role secondaire), une seule fois la liste
  // recuperee pour tous les retards de ce passage.
  const { data: recipients } = await supabase.from('profiles')
    .select('email,name,role,secondary_roles')
    .eq('active', true)
  const notifyList = (recipients || []).filter(p =>
    ['admin', 'superviseur', 'responsable_suivi'].includes(p.role) ||
    (p.secondary_roles || []).includes('responsable_suivi')
  )

  let alertsSent = 0
  for (const task of overdueTasks) {
    const contactName = `${task.contact?.first_name || ''} ${task.contact?.last_name || ''}`.trim() || '—'
    const integratorName = task.assignee?.name || 'Non assigné'
    const late = daysLate(task.due_date)

    for (const r of notifyList) {
      if (!r.email) continue
      await resend.emails.send({
        from: 'Impact Connect <onboarding@resend.dev>',
        to: r.email,
        subject: '⚠️ Action de suivi en retard',
        html: emailWrapper(`
          <p style="font-size:15px;line-height:1.7;">Bonjour,</p>
          <p style="font-size:15px;line-height:1.7;">Une action de suivi est actuellement en retard.</p>
          <table style="width:100%;font-size:14px;margin:16px 0;">
            <tr><td style="padding:4px 0;color:#64748B;">Intégrateur</td><td style="padding:4px 0;font-weight:700;">${integratorName}</td></tr>
            <tr><td style="padding:4px 0;color:#64748B;">Nouveau</td><td style="padding:4px 0;font-weight:700;">${contactName}</td></tr>
            <tr><td style="padding:4px 0;color:#64748B;">Étape concernée</td><td style="padding:4px 0;font-weight:700;">${task.title || task.type}</td></tr>
            <tr><td style="padding:4px 0;color:#64748B;">Retard</td><td style="padding:4px 0;font-weight:700;color:#DC2626;">${late} jour${late > 1 ? 's' : ''}</td></tr>
          </table>
          <p style="font-size:15px;line-height:1.7;">Merci de vérifier cette situation avec l'intégrateur.</p>
        `),
      }).catch(console.error)
    }

    await supabase.from('tasks').update({ overdue_alert_sent: true }).eq('id', task.id)
    alertsSent++
  }

  return { checked: 'overdue_tasks', alertsSent }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  // Chaque garde-fou est independant : en ajouter un nouveau plus tard
  // (ex: FIJ sans compte-rendu depuis 3 semaines) = une fonction de
  // plus dans ce tableau, sans toucher a l'existant.
  const results = await Promise.all([
    checkOverdueTasks(supabase),
  ])

  return NextResponse.json({ success: true, results })
}
