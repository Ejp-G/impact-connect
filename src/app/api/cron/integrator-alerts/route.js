import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function emailWrapper(title, bodyHtml) {
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display:inline-block;background:#0B3D91;color:#fff;font-size:18px;font-weight:800;padding:10px 20px;border-radius:12px;">EJP Guadeloupe</div>
      </div>
      <p style="font-size:16px;font-weight:700;margin-bottom:12px;">${title}</p>
      ${bodyHtml}
      <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:24px;text-align:center;color:#94A3B8;font-size:12px;">Prodiges Connect — EJP Guadeloupe</div>
    </div>
  `
}

async function sendEmail(email, subject, html) {
  if (!email) return
  try {
    await resend.emails.send({ from: 'EJP Guadeloupe <onboarding@resend.dev>', to: email, subject, html })
  } catch (err) {
    console.error('Erreur email integrator-alerts:', err)
  }
}

async function notifyUsers(supabase, userIds, title, message) {
  const rows = userIds.filter(Boolean).map(user_id => ({ user_id, type: 'integrator_alert', title, message }))
  if (rows.length) await supabase.from('notifications').insert(rows)
}

// Escalade des relances pour le binome d'integrateurs assigne a chaque
// nouveau contact. Paliers bases sur le temps ecoule depuis
// assignment_date, tant qu'aucun rapport (integrator_reports) n'a ete
// enregistre par l'un des deux (integrator_contacted reste false).
//
// 24h  -> notification interne au binome
// 48h  -> email au binome
// 72h  -> email + notification renforcee au binome (pas de vrai SMS
//         tant qu'aucun fournisseur SMS n'est configure — a remplacer
//         par un envoi SMS reel le jour ou un fournisseur est branche,
//         sans toucher au reste de l'echelle)
// 96h  -> email + notification au responsable_suivi
// 120h -> email + notification a toute l'equipe Suivi
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const stats = { h24: 0, h48: 0, h72: 0, h96: 0, h120: 0 }
  const now = Date.now()

  const { data: pending } = await supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, sex, assignment_date,
      integrator_reminder_24h_sent, integrator_reminder_48h_sent,
      integrator_reminder_72h_sent, integrator_reminder_96h_sent, integrator_reminder_120h_sent,
      integrators:contact_integrators(position, integrator:profiles(id,name,email))
    `)
    .eq('status', 'active')
    .eq('integrator_contacted', false)
    .not('assignment_date', 'is', null)

  const { data: responsables } = await supabase
    .from('profiles').select('id,email,name').eq('role', 'responsable_suivi').eq('active', true)
  const { data: allSuivi } = await supabase
    .from('profiles').select('id,email,name').in('role', ['equipe_suivi', 'responsable_suivi']).eq('active', true)

  for (const c of pending || []) {
    const hoursElapsed = (now - new Date(c.assignment_date).getTime()) / 3600000
    const pair = (c.integrators || []).map(i => i.integrator).filter(Boolean)
    const pairEmails = pair.filter(p => p?.email)
    const fullName = `${c.first_name} ${c.last_name}`

    if (hoursElapsed >= 120 && !c.integrator_reminder_120h_sent) {
      for (const p of allSuivi || []) {
        await sendEmail(p.email, `🚨🚨 ${fullName} sans contact depuis 5 jours`, emailWrapper(
          `Salut ${(p.name || '').split(' ')[0]},`,
          `<p style="font-size:15px;line-height:1.7;"><strong>${fullName}</strong> n'a toujours pas été contacté(e) depuis 5 jours par son binôme d'intégrateurs. Toute l'équipe Suivi est notifiée pour qu'aucune personne ne soit oubliée.</p>`
        ))
      }
      await notifyUsers(supabase, (allSuivi || []).map(p => p.id),
        `🚨🚨 ${fullName} sans contact depuis 5 jours`,
        `Toute l'équipe Suivi est notifiée.`)
      await supabase.from('contacts').update({ integrator_reminder_120h_sent: true }).eq('id', c.id)
      stats.h120++
    } else if (hoursElapsed >= 96 && !c.integrator_reminder_96h_sent) {
      for (const r of responsables || []) {
        await sendEmail(r.email, `🚨 ${fullName} toujours sans contact (96h)`, emailWrapper(
          `Salut ${(r.name || '').split(' ')[0]},`,
          `<p style="font-size:15px;line-height:1.7;"><strong>${fullName}</strong> n'a toujours pas été contacté(e) après 96h par son binôme d'intégrateurs. Une intervention est nécessaire.</p>`
        ))
      }
      await notifyUsers(supabase, (responsables || []).map(r => r.id),
        `🚨 ${fullName} toujours sans contact (96h)`,
        `Le binôme assigné n'a pas encore confirmé de contact.`)
      await supabase.from('contacts').update({ integrator_reminder_96h_sent: true }).eq('id', c.id)
      stats.h96++
    } else if (hoursElapsed >= 72 && !c.integrator_reminder_72h_sent) {
      for (const p of pairEmails) {
        await sendEmail(p.email, `🚨 URGENT : ${fullName} sans contact depuis 72h`, emailWrapper(
          `Salut ${(p.name || '').split(' ')[0]},`,
          `<p style="font-size:15px;line-height:1.7;"><strong>${fullName}</strong> attend un premier contact depuis 72h. Merci d'agir rapidement.</p>`
        ))
      }
      await notifyUsers(supabase, pair.map(p => p.id),
        `🚨 URGENT : ${fullName} sans contact depuis 72h`,
        `Action requise rapidement.`)
      await supabase.from('contacts').update({ integrator_reminder_72h_sent: true }).eq('id', c.id)
      stats.h72++
    } else if (hoursElapsed >= 48 && !c.integrator_reminder_48h_sent) {
      for (const p of pairEmails) {
        await sendEmail(p.email, `⏰ Relance : ${fullName} n'a pas encore été contacté(e)`, emailWrapper(
          `Salut ${(p.name || '').split(' ')[0]},`,
          `<p style="font-size:15px;line-height:1.7;"><strong>${fullName}</strong> vous a été confié(e) il y a 48h et le premier contact n'a pas encore été confirmé dans Prodiges Connect. Merci de le/la contacter dès que possible.</p>`
        ))
      }
      await supabase.from('contacts').update({ integrator_reminder_48h_sent: true }).eq('id', c.id)
      stats.h48++
    } else if (hoursElapsed >= 24 && !c.integrator_reminder_24h_sent) {
      await notifyUsers(supabase, pair.map(p => p.id),
        `⏰ ${fullName} à contacter`,
        `${fullName} vous a été confié(e) il y a 24h. Pensez à le/la contacter rapidement.`)
      await supabase.from('contacts').update({ integrator_reminder_24h_sent: true }).eq('id', c.id)
      stats.h24++
    }
  }

  return NextResponse.json({ success: true, stats })
}
