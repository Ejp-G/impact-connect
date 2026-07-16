import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Récupérer tous les contacts actifs avec email et wantsFI
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('first_name, email')
    .eq('status', 'active')
    .eq('wants_fi', true)
    .not('email', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const contact of contacts || []) {
    if (!contact.email) continue
    try {
      await resend.emails.send({
        from: 'EJP Guadeloupe <onboarding@resend.dev>',
        to: contact.email,
        subject: 'Rappel — Famille d\'Impact ce jeudi 🙏',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #0B3D91; color: white; font-size: 20px; font-weight: 800; padding: 10px 20px; border-radius: 12px; letter-spacing: 1px;">
                EJP Guadeloupe
              </div>
            </div>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Coucou <strong>${contact.first_name}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              Petit rappel : notre Famille d'Impact se retrouve ce jeudi.
            </p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              C'est un moment simple pour partager, apprendre à se connaître et grandir ensemble autour de la Parole. On sera heureux de te retrouver.
            </p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
              À très bientôt !
            </p>
            <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 13px;">
              Église Jeunes Prodiges Guadeloupe — Impact Connect
            </div>
          </div>
        `,
      })
      sent++
    } catch (err) {
      console.error(`Erreur email FI pour ${contact.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent })
}
