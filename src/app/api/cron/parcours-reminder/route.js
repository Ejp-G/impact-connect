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

// Rappel UNIQUE (pas une escalade repetee) : 30 jours apres l'integration
// en FIJ, si personne n'a encore coche "Parcours de croissance commence"
// sur la fiche, on notifie une fois responsable_suivi + admin.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  const { data: pending } = await supabase.from('contacts')
    .select('id,first_name,last_name,integrated_at')
    .eq('status', 'active')
    .eq('stage', 'integre')
    .eq('parcours_reminder_sent', false)
    .not('integrated_at', 'is', null)
    .lte('integrated_at', cutoff)

  if (!pending?.length) return NextResponse.json({ success: true, sent: 0 })

  const { data: recipients } = await supabase.from('profiles')
    .select('id,email,name').in('role', ['admin', 'responsable_suivi']).eq('active', true)

  for (const c of pending) {
    const fullName = `${c.first_name} ${c.last_name}`
    for (const r of recipients || []) {
      if (r.email) {
        await resend.emails.send({
          from: 'EJP Guadeloupe <onboarding@resend.dev>', to: r.email,
          subject: `${fullName} : Parcours de croissance commencé ?`,
          html: emailWrapper(
            `Salut ${(r.name || '').split(' ')[0]},`,
            `<p style="font-size:15px;line-height:1.7;"><strong>${fullName}</strong> est intégré(e) en Famille d'Impact depuis 30 jours. Pense à vérifier si le Parcours de croissance a commencé, et à cocher la case sur sa fiche si c'est le cas.</p>`
          )
        }).catch(console.error)
      }
    }
    await supabase.from('notifications').insert(
      (recipients || []).map(r => ({
        user_id: r.id, type: 'parcours_reminder',
        title: `${fullName} : Parcours de croissance ?`,
        message: `Intégré(e) depuis 30 jours, à vérifier.`
      }))
    )
    await supabase.from('contacts').update({ parcours_reminder_sent: true }).eq('id', c.id)
  }

  return NextResponse.json({ success: true, sent: pending.length })
}
