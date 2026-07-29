import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Tables sauvegardees quotidiennement. On exporte TOUT (y compris
// archives/supprimes) car l'objectif est la reprise en cas de sinistre,
// pas seulement les donnees actives.
const TABLES = [
  'contacts', 'familles_impact', 'contact_integrators', 'integrator_reports',
  'contact_needs', 'tasks', 'profiles', 'communes'
]

// Serialisation CSV simple, sans dependance externe. Gere l'echappement
// des virgules/guillemets/retours a la ligne, et convertit les valeurs
// JSON (jsonb, tableaux) en texte lisible dans le fichier.
function toCSV(rows) {
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (val) => {
    if (val === null || val === undefined) return ''
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
    return str
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','))
  }
  return lines.join('\n')
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const attachments = []
  const summary = {}

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(100000)
    if (error) {
      summary[table] = `Erreur : ${error.message}`
      continue
    }
    summary[table] = data?.length || 0
    const csv = toCSV(data || [])
    attachments.push({
      filename: `${table}_${today}.csv`,
      content: Buffer.from(csv).toString('base64')
    })
  }

  const { data: admins } = await supabase.from('profiles')
    .select('email').eq('role', 'admin').eq('active', true)
  const recipients = (admins || []).map(a => a.email).filter(Boolean)

  if (recipients.length) {
    try {
      await resend.emails.send({
        from: 'EJP Guadeloupe <onboarding@resend.dev>',
        to: recipients,
        subject: `📦 Sauvegarde quotidienne Prodiges Connect — ${today}`,
        html: `
          <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
            <p style="font-size:16px;font-weight:700;">Sauvegarde automatique du ${today}</p>
            <p style="font-size:14px;line-height:1.7;">Les fichiers CSV de toutes les tables principales sont joints à cet email. Conservez cet email en lieu sûr (dossier dédié dans votre boîte mail ou synchronisé vers un espace de stockage externe).</p>
            <ul style="font-size:13px;color:#475569;line-height:1.8;">
              ${Object.entries(summary).map(([t, c]) => `<li><strong>${t}</strong> : ${c} ligne(s)</li>`).join('')}
            </ul>
          </div>
        `,
        attachments
      })
    } catch (err) {
      console.error('Erreur envoi sauvegarde:', err)
      return NextResponse.json({ error: 'Échec envoi email', summary }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, date: today, summary, recipients: recipients.length })
}
