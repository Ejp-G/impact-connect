import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoAttributeContact } from '@/lib/attribution'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendWelcomeEmail(firstName, email) {
  if (!email) return
  try {
    await resend.emails.send({
      from: 'EJP Guadeloupe <onboarding@resend.dev>',
      to: email,
      subject: 'Bienvenue parmi nous 🙏',
      html: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: #0B3D91; color: white; font-size: 20px; font-weight: 800; padding: 10px 20px; border-radius: 12px; letter-spacing: 1px;">
              EJP Guadeloupe
            </div>
          </div>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Coucou <strong>${firstName}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
            Merci d'avoir été parmi nous aujourd'hui. Ça nous a fait vraiment plaisir de te rencontrer.
          </p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
            Nous espérons que tu as passé un bon moment. Si tu as la moindre question ou simplement envie d'échanger, nous sommes là.
          </p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
            Prends soin de toi, et à très bientôt.
          </p>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 13px;">
            Église Jeunes Prodiges Guadeloupe — Impact Connect
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('Erreur email bienvenue:', err)
  }
}

export async function GET(request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const alert = searchParams.get('alert')
  const commune = searchParams.get('commune')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  let query = supabase.from('contacts')
    .select(`*, fi:familles_impact(id,name), agent:profiles!contacts_assigned_to_fkey(id,name)`, { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (stage) query = query.eq('stage', stage)
  if (alert) query = query.eq('alert_level', alert)
  if (commune) query = query.eq('commune', commune)
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json()
  const { firstName, lastName, sex, dateOfBirth, phone, whatsapp, email,
          commune, communeId, quartier, firstVisit, salvationCall,
          wantsContact, wantsFI, interests, prayerRequest, howFound, situation,
          parentLastName, parentFirstName, parentPhone, parentEmail, parentRelation } = body

  if (!firstName || !lastName || !sex) {
    return NextResponse.json({ error: 'Prénom, nom et sexe sont obligatoires' }, { status: 400 })
  }

  const isMinor = dateOfBirth
    ? new Date(dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    : false

  if (isMinor && (!parentLastName || !parentPhone)) {
    return NextResponse.json({ error: 'Informations du parent obligatoires pour les mineurs' }, { status: 400 })
  }

  const contactData = {
    first_name: firstName, last_name: lastName, sex,
    date_of_birth: dateOfBirth || null,
    phone, whatsapp, email,
    commune, commune_id: communeId || null, quartier,
    first_visit: firstVisit, salvation_call: salvationCall,
    wants_contact: wantsContact, wants_fi: wantsFI,
    interests, prayer_request: prayerRequest, how_found: howFound, situation,
    parental_status: isMinor ? 'pending' : 'not_required',
    parent_last_name: parentLastName, parent_first_name: parentFirstName,
    parent_phone: parentPhone, parent_email: parentEmail, parent_relation: parentRelation,
  }

  const { data: contact, error } = await supabase.from('contacts').insert(contactData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Email de bienvenue automatique
  if (email) {
    sendWelcomeEmail(firstName, email).catch(console.error)
  }

  // Attribution automatique (agent + FIJ, avec notification pilote)
  if (!isMinor && wantsFI) {
    autoAttributeContact({
      contactId: contact.id, sex, communeId: communeId || null, quartier: quartier || null
    }).catch(console.error)
  }

  // Notifications admins
  const adminClient = createAdminClient()
  const { data: admins } = await adminClient.from('profiles')
    .select('id').in('role', ['admin', 'responsable_integration'])
  if (admins?.length) {
    await adminClient.from('notifications').insert(
      admins.map(a => ({
        user_id: a.id, type: 'new_contact',
        title: 'Nouveau visiteur',
        message: `${firstName} ${lastName} vient de s'inscrire (${commune || 'commune non renseignée'})`,
      }))
    )
  }

  return NextResponse.json({ data: contact }, { status: 201 })
}
