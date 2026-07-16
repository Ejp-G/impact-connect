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

  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  // Contacts dont c'est l'anniversaire aujourd'hui
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('first_name, email, date_of_birth')
    .eq('status', 'active')
    .not('email', 'is', null)
    .not('date_of_birth', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const birthdays = (contacts || []).filter(c => {
    if (!c.date_of_birth) return false
    const dob = new Date(c.date_of_birth)
    return (
      String(dob.getMonth() + 1).padStart(2, '0') === month &&
      String(dob.getDate()).padStart(2, '0') === day
    )
  })

  let sent = 0
  for (const contact of birthdays) {
    try {
      await resend.emails.send({
        from: 'EJP Guadeloupe <onboarding@resend.dev>',
        to: contact.email,
        subject: `Joyeux anniversaire ${contact.first_name} ! 🎂`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #0B3D91; color: white; font-size: 20px; font-weight: 800; padding: 10px 20px; border-radius: 12px; letter-spacing: 1px;">
                EJP Guadeloupe
              </div>
            </div>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Joyeux anniversaire <strong>${contact.first_name}</strong> ! 🎂</p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              On voulait simplement te souhaiter une très belle journée.
            </p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              Que cette nouvelle année soit remplie de paix, de joie et de belles surprises. Que Dieu te garde et te bénisse dans tout ce que tu entreprends.
            </p>
            <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
              Profite bien de ta journée ! 🙏
            </p>
            <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 13px;">
              Église Jeunes Prodiges Guadeloupe — Impact Connect
            </div>
          </div>
        `,
      })
      sent++
    } catch (err) {
      console.error(`Erreur email anniversaire pour ${contact.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent })
}
