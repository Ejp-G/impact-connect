import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { STAGE_LABEL } from '@/lib/constants'

// ---------------------------------------------------------------
// Config extensible : ajouter un 3e (ou 4e) integrateur demain se
// fait ici, nulle part ailleurs. INTEGRATOR_SLOTS pilote a la fois
// les colonnes Excel/PDF et la recherche du dernier compte-rendu par
// position.
// ---------------------------------------------------------------
const INTEGRATOR_SLOTS = [1, 2]

const STATUS_STYLES = {
  ne_pas_contacter: { label: 'Ne pas contacter', color: 'FFE2E8F0', emoji: '⚪' },
  en_retard:        { label: 'En retard',         color: 'FFFECACA', emoji: '🔴' },
  reconciliation:   { label: 'Réconciliation',    color: 'FFE9D5FF', emoji: '🟣' },
  appel_salut:       { label: 'Appel au salut',    color: 'FFFED7AA', emoji: '🟠' },
  integre:          { label: 'Intégré FI',        color: 'FFBBF7D0', emoji: '🟢' },
  contacte:         { label: 'Contacté',          color: 'FFBFDBFE', emoji: '🔵' },
  nouveau:          { label: 'Nouveau',           color: 'FFFEF9C3', emoji: '🟡' },
}

function computeStatus(c, hasReconciliation) {
  if (c.contact_preference === 'none') return 'ne_pas_contacter'
  if (c.alert_level === 'red') return 'en_retard'
  if (hasReconciliation) return 'reconciliation'
  if (c.salvation_call) return 'appel_salut'
  if (['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader'].includes(c.stage)) return 'integre'
  if (c.integrator_contacted) return 'contacte'
  return 'nouveau'
}

function computeAction(c) {
  if (c.contact_preference === 'none') return 'Ne pas contacter'
  const map = {
    visiteur: '📞 Appeler',
    contacte: '🏠 Inviter en FI',
    invite_fi: '📅 Confirmer présence FI',
    fi1: '📅 Relancer pour 2ème FI',
    fi2: '✅ Confirmer intégration',
    integre: '📖 Parcours de croissance',
    parcours: '✅ Parcours terminé',
  }
  return map[c.stage] || '🙏 Prier / Suivre'
}

function computeSuivi(c) {
  if (['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader'].includes(c.stage)) return '🟢 Terminé'
  if (c.integrator_contacted) return '🟡 En cours'
  return '⬜ Non commencé'
}

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return ''
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 86400000))
}

const BASE_COLUMNS = [
  'Statut', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Âge', 'Téléphone', 'Email', 'Adresse',
  'Commune', 'Date de première visite', 'Connecteur',
]
const MID_COLUMNS = [
  "Famille d'Impact", 'Étape actuelle', 'Dernier contact', 'Prochain contact',
  'Nombre de contacts', 'Score', 'Priorité', 'Action à réaliser', 'Suivi',
]

function integratorColumns() {
  const cols = []
  INTEGRATOR_SLOTS.forEach(pos => {
    cols.push(`Intégrateur ${pos}`, `Intégrateur ${pos} — Date`, `Intégrateur ${pos} — Moyen`, `Intégrateur ${pos} — Compte rendu`)
  })
  return cols
}

function buildRow(c, reportsByContact, needsByContact) {
  const hasReconciliation = (needsByContact[c.id] || []).some(n => n.category === 'reconciliation')
  const status = computeStatus(c, hasReconciliation)
  const allReports = reportsByContact[c.id] || []
  const integratorsByPos = {}
  ;(c.integrators || []).forEach(i => { integratorsByPos[i.position] = i })

  const lastContactAt = allReports[0]?.contacted_at || null
  const nextContact = allReports.find(r => r.next_contact_date)?.next_contact_date || null

  const row = {
    Statut: STATUS_STYLES[status].label,
    Nom: c.last_name || '', Prénom: c.first_name || '', Sexe: c.sex === 'F' ? 'Femme' : 'Homme',
    'Date de naissance': c.date_of_birth || '', 'Âge': computeAge(c.date_of_birth),
    Téléphone: c.phone || '', Email: c.email || '', Adresse: c.address || '',
    Commune: c.commune || '', 'Date de première visite': c.first_visit_date || '',
    Connecteur: c.welcomed_by_name || '',
    "Famille d'Impact": c.fi?.name || '', 'Étape actuelle': STAGE_LABEL(c.stage),
    'Dernier contact': lastContactAt ? new Date(lastContactAt).toLocaleDateString('fr-FR') : 'Jamais',
    'Prochain contact': nextContact || '—',
    'Nombre de contacts': allReports.length,
    Score: c.integration_score ?? 0,
    Priorité: c.alert_level === 'red' ? 'Urgent' : c.alert_level === 'orange' ? 'Modérée' : 'Normale',
    'Action à réaliser': computeAction(c),
    Suivi: computeSuivi(c),
    _status: status,
  }

  INTEGRATOR_SLOTS.forEach(pos => {
    const integrator = integratorsByPos[pos]
    const lastReportForSlot = allReports.find(r => r.integrator_id === integrator?.integrator_id)
    row[`Intégrateur ${pos}`] = integrator?.integrator?.name || '—'
    row[`Intégrateur ${pos} — Date`] = lastReportForSlot ? new Date(lastReportForSlot.contacted_at).toLocaleDateString('fr-FR') : ''
    row[`Intégrateur ${pos} — Moyen`] = lastReportForSlot?.method || ''
    row[`Intégrateur ${pos} — Compte rendu`] = lastReportForSlot?.notes || ''
  })

  return row
}

export async function POST(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const body = await request.json()
  const { format, scope, integratorId, fiId, commune, period, sundayDate, dateFrom, dateTo, quick = {}, includeHistory } = body

  let query = supabase.from('contacts')
    .select(`
      id,first_name,last_name,sex,date_of_birth,phone,email,address,commune,first_visit_date,
      welcomed_by_name,stage,integration_score,alert_level,contact_preference,salvation_call,
      integrator_contacted,assigned_to,fi_id,
      fi:familles_impact(name),
      integrators:contact_integrators(position,integrator_id,integrator:profiles(name))
    `)
    .eq('status', 'active')

  if (scope === 'mine') query = query.eq('assigned_to', session.user.id)
  else if (scope === 'integrator' && integratorId) query = query.eq('assigned_to', integratorId)
  if (fiId) query = query.eq('fi_id', fiId)
  if (commune) query = query.eq('commune', commune)

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  if (period === 'today') query = query.eq('first_visit_date', todayStr)
  if (period === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    query = query.gte('first_visit_date', start.toISOString().slice(0, 10))
  }
  if (period === 'month') query = query.gte('first_visit_date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  if (period === 'year') query = query.gte('first_visit_date', new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10))
  if (period === 'sunday' && sundayDate) query = query.eq('first_visit_date', sundayDate)
  if (period === 'range' && dateFrom && dateTo) query = query.gte('first_visit_date', dateFrom).lte('first_visit_date', dateTo)

  const { data: contactsRaw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contactIds = (contactsRaw || []).map(c => c.id)
  const [{ data: reports }, { data: needs }] = await Promise.all([
    contactIds.length
      ? supabase.from('integrator_reports').select('contact_id,integrator_id,contacted_at,method,notes,next_contact_date').in('contact_id', contactIds).order('contacted_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase.from('contact_needs').select('contact_id,category').in('contact_id', contactIds)
      : Promise.resolve({ data: [] }),
  ])

  const reportsByContact = {}
  ;(reports || []).forEach(r => { (reportsByContact[r.contact_id] = reportsByContact[r.contact_id] || []).push(r) })
  const needsByContact = {}
  ;(needs || []).forEach(n => { (needsByContact[n.contact_id] = needsByContact[n.contact_id] || []).push(n) })

  let contacts = contactsRaw || []
  if (quick.nouveaux) contacts = contacts.filter(c => (Date.now() - new Date(c.first_visit_date || c.created_at).getTime()) / 86400000 <= 7)
  if (quick.appels_salut) contacts = contacts.filter(c => c.salvation_call)
  if (quick.reconciliations) contacts = contacts.filter(c => (needsByContact[c.id] || []).some(n => n.category === 'reconciliation'))
  if (quick.urgences) contacts = contacts.filter(c => c.alert_level === 'red')
  if (quick.sans_fi) contacts = contacts.filter(c => !c.fi_id)
  if (quick.sans_integrateur) contacts = contacts.filter(c => !(c.integrators || []).length)

  const rows = contacts.map(c => buildRow(c, reportsByContact, needsByContact))

  const allColumns = [...BASE_COLUMNS, ...integratorColumns(), ...MID_COLUMNS]

  if (format === 'xlsx') {
    const buffer = await buildXlsx(rows, allColumns, profile, includeHistory, reports || [], contacts)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="suivi_prodiges_connect_${todayStr}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    const buffer = buildPdf(rows, allColumns, profile, scope, integratorId)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="suivi_prodiges_connect_${todayStr}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
}

// ---------------------------------------------------------------
// EXCEL (mise en forme complete : entetes bleu fonce/texte blanc,
// filtres auto, ligne figee, largeur auto, couleur de ligne par
// statut). S'ouvre directement dans Google Sheets via Fichier > Importer.
// ---------------------------------------------------------------
async function buildXlsx(rows, columns, profile, includeHistory, reports, contacts) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Prodiges Connect'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Suivi des visiteurs', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  sheet.columns = columns.map(c => ({ header: c, key: c, width: Math.max(14, c.length + 2) }))

  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072B6A' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  headerRow.height = 24

  rows.forEach(r => {
    const dataRow = sheet.addRow(r)
    const style = STATUS_STYLES[r._status]
    dataRow.eachCell((cell, colNumber) => {
      if (columns[colNumber - 1] === 'Statut') return
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.color } }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  if (includeHistory) {
    const histSheet = workbook.addWorksheet('Historique complet', { views: [{ state: 'frozen', ySplit: 1 }] })
    const histColumns = ['Visiteur', 'Date', 'Intégrateur', 'Type de contact', 'Compte rendu', 'Prochaine action']
    histSheet.columns = histColumns.map(c => ({ header: c, key: c, width: Math.max(16, c.length + 2) }))
    const hHeader = histSheet.getRow(1)
    hHeader.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072B6A' } }
    })
    const contactById = {}
    contacts.forEach(c => { contactById[c.id] = `${c.first_name} ${c.last_name}` })
    reports.forEach(r => {
      histSheet.addRow({
        Visiteur: contactById[r.contact_id] || '—',
        Date: new Date(r.contacted_at).toLocaleDateString('fr-FR'),
        Intégrateur: r.integrator_id || '',
        'Type de contact': r.method || '',
        'Compte rendu': r.notes || '',
        'Prochaine action': r.next_contact_date || '',
      })
    })
    histSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: histColumns.length } }
  }

  return await workbook.xlsx.writeBuffer()
}

// ---------------------------------------------------------------
// PDF (A4 paysage, pret a imprimer)
// ---------------------------------------------------------------
function buildPdf(rows, columns, profile, scope, integratorId) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const today = new Date().toLocaleDateString('fr-FR')

  doc.setFontSize(16)
  doc.setTextColor(11, 61, 145)
  doc.text('PRODIGES CONNECT', 14, 14)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('Église Jeunes Prodiges Guadeloupe', 14, 20)
  doc.text(`Généré le ${today}`, 14, 25)
  if (scope === 'mine' || scope === 'integrator') {
    doc.text(`Portefeuille : ${profile?.name || '—'}`, 14, 30)
  }
  doc.text(`Nombre total de visiteurs : ${rows.length}`, 200, 20)

  // Colonnes essentielles seulement pour la lisibilite A4 (le detail
  // complet reste dans l'export Excel) : le PDF est pense pour un
  // usage terrain rapide, pas pour remplacer la feuille de calcul.
  const pdfColumns = ['Statut', 'Nom', 'Prénom', 'Téléphone', 'Commune', 'Étape actuelle',
    'Intégrateur 1', 'Intégrateur 2', 'Dernier contact', 'Prochain contact', 'Action à réaliser', 'Suivi']

  const tableRows = rows.map(r => pdfColumns.map(c => String(r[c] ?? '')))

  autoTable(doc, {
    head: [pdfColumns],
    body: tableRows,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [7, 43, 106], textColor: 255, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const status = rows[data.row.index]._status
        const hex = STATUS_STYLES[status]?.color?.slice(2) // retire l'alpha ARGB
        if (hex) {
          const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
          data.cell.styles.fillColor = [r, g, b]
        }
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 8)
    },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
