import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { STAGES, STAGE_LABEL } from '@/lib/constants'

const INTEGRATOR_SLOTS = [1, 2]

const RESULT_LABELS = {
  repondu: 'Répondu', pas_de_reponse: 'Pas répondu', messagerie: 'Messagerie',
  numero_invalide: 'Pas répondu',
}
const RESULT_OPTIONS = ['Répondu', 'Pas répondu', 'Messagerie', 'WhatsApp envoyé', 'Rendez-vous pris', 'Reporté']
const PRIORITY_OPTIONS = ['Haute', 'Moyenne', 'Faible']

function computeStatus(c, hasReconciliation) {
  if (c.contact_preference === 'none') return 'Ne pas contacter'
  if (c.alert_level === 'red') return 'Urgence'
  if (hasReconciliation) return 'Réconciliation'
  if (c.salvation_call) return 'Appel au salut'
  if (['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader'].includes(c.stage)) return 'Intégré FI'
  if (c.integrator_contacted) return 'Contacté'
  return 'Nouveau'
}

function computePriority(alertLevel) {
  if (alertLevel === 'red') return 'Haute'
  if (alertLevel === 'orange') return 'Moyenne'
  return 'Faible'
}

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return ''
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 86400000))
}

function buildColumns() {
  const integratorCols = INTEGRATOR_SLOTS.map(pos => `Intégrateur ${pos}`)
  return [
    'Statut', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Âge', 'Téléphone', 'Email', 'Adresse',
    'Commune', 'Date de première visite', 'Connecteur',
    ...integratorCols,
    "Famille d'Impact", 'Étape actuelle',
    'Dernier suivi effectué par', 'Date du dernier suivi', 'Prochaine action', 'Date prévue de cette action', 'Résultat', 'Priorité',
    'Nombre de contacts', 'Score',
    'Appelé', 'WhatsApp envoyé', 'Invité en FI', 'Revu au culte',
    'Commentaires / Notes',
  ]
}

function buildRow(c, reportsByContact, needsByContact) {
  const hasReconciliation = (needsByContact[c.id] || []).some(n => n.category === 'reconciliation')
  const status = computeStatus(c, hasReconciliation)
  const allReports = reportsByContact[c.id] || []
  const integratorsByPos = {}
  ;(c.integrators || []).forEach(i => { integratorsByPos[i.position] = i })

  const lastReport = allReports[0] || null
  const priority = computePriority(c.alert_level)

  const notesPreview = allReports.slice(0, 3)
    .filter(r => r.notes)
    .map(r => `[${new Date(r.contacted_at).toLocaleDateString('fr-FR')} — ${r.integrator?.name || '?'}] ${r.notes}`)
    .join('\n')

  const row = {
    Statut: status,
    Nom: c.last_name || '', Prénom: c.first_name || '', Sexe: c.sex === 'F' ? 'Femme' : 'Homme',
    'Date de naissance': c.date_of_birth || '', 'Âge': computeAge(c.date_of_birth),
    Téléphone: c.phone || '', Email: c.email || '', Adresse: c.address || '',
    Commune: c.commune || '', 'Date de première visite': c.first_visit_date || '',
    Connecteur: c.welcomed_by_name || '',
    "Famille d'Impact": c.fi?.name || '', 'Étape actuelle': STAGE_LABEL(c.stage),
    'Dernier suivi effectué par': lastReport?.integrator?.name || '—',
    'Date du dernier suivi': lastReport ? new Date(lastReport.contacted_at).toLocaleDateString('fr-FR') : '',
    'Prochaine action': lastReport?.next_action || '',
    'Date prévue de cette action': lastReport?.next_contact_date || '',
    'Résultat': lastReport?.result ? (RESULT_LABELS[lastReport.result] || '') : '',
    'Priorité': priority,
    'Nombre de contacts': allReports.length,
    Score: c.integration_score ?? 0,
    'Appelé': !!c.integrator_contacted,
    'WhatsApp envoyé': !!c.fi_whatsapp_added,
    'Invité en FI': ['invite_fi', 'fi1', 'fi2', 'integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader'].includes(c.stage),
    'Revu au culte': false,
    'Commentaires / Notes': notesPreview,
    _priority: priority,
    _integre: ['integre', 'parcours', 'bapteme', 'service', 'leader_pot', 'leader'].includes(c.stage),
  }

  INTEGRATOR_SLOTS.forEach(pos => {
    row[`Intégrateur ${pos}`] = integratorsByPos[pos]?.integrator?.name || '—'
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
      integrator_contacted,fi_whatsapp_added,assigned_to,fi_id,
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
      ? supabase.from('integrator_reports')
          .select('contact_id,integrator_id,contacted_at,method,result,notes,next_action,next_contact_date,integrator:profiles(name)')
          .in('contact_id', contactIds).order('contacted_at', { ascending: false })
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
  const allColumns = buildColumns()

  if (format === 'xlsx') {
    const buffer = await buildXlsx(rows, allColumns, includeHistory, reports || [], contacts)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="suivi_prodiges_connect_${todayStr}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    const buffer = buildPdf(rows, profile, scope)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="suivi_prodiges_connect_${todayStr}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
}

async function buildXlsx(rows, columns, includeHistory, reports, contacts) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Prodiges Connect'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Suivi des visiteurs', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  const checkboxCols = ['Appelé', 'WhatsApp envoyé', 'Invité en FI', 'Revu au culte']
  sheet.columns = columns.map(c => ({
    header: c, key: c,
    width: c === 'Commentaires / Notes' ? 60 : checkboxCols.includes(c) ? 12 : Math.max(14, c.length + 2),
  }))

  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072B6A' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  headerRow.height = 26

  const priorityCol = columns.indexOf('Priorité') + 1
  const stageCol = columns.indexOf('Étape actuelle') + 1
  const resultCol = columns.indexOf('Résultat') + 1
  const notesCol = columns.indexOf('Commentaires / Notes') + 1

  rows.forEach((r, idx) => {
    const dataRow = sheet.addRow(r)
    const zebra = idx % 2 === 1
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10.5 }
      cell.alignment = { vertical: 'middle', wrapText: colNumber === notesCol }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } }
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    })
    const priorityCell = dataRow.getCell(priorityCol)
    if (r._priority === 'Haute') priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
    else if (r._priority === 'Moyenne') priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }
    if (r._integre) dataRow.getCell(stageCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } }

    dataRow.getCell(priorityCol).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${PRIORITY_OPTIONS.join(',')}"`] }
    dataRow.getCell(resultCol).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${RESULT_OPTIONS.join(',')}"`] }
    dataRow.getCell(stageCol).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${STAGES.map(s => s.label).join(',')}"`] }
  })

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  if (includeHistory) {
    const histSheet = workbook.addWorksheet('Historique complet', { views: [{ state: 'frozen', ySplit: 1 }] })
    const histColumns = ['Visiteur', 'Date', 'Intégrateur', 'Type de contact', 'Résultat', 'Compte rendu', 'Prochaine action']
    histSheet.columns = histColumns.map(c => ({ header: c, key: c, width: c === 'Compte rendu' ? 50 : Math.max(16, c.length + 2) }))
    const hHeader = histSheet.getRow(1)
    hHeader.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072B6A' } }
    })
    const contactById = {}
    contacts.forEach(c => { contactById[c.id] = `${c.first_name} ${c.last_name}` })
    reports.forEach((r, idx) => {
      const histRow = histSheet.addRow({
        Visiteur: contactById[r.contact_id] || '—',
        Date: new Date(r.contacted_at).toLocaleDateString('fr-FR'),
        Intégrateur: r.integrator?.name || '',
        'Type de contact': r.method || '',
        'Résultat': RESULT_LABELS[r.result] || r.result || '',
        'Compte rendu': r.notes || '',
        'Prochaine action': r.next_action || '',
      })
      if (idx % 2 === 1) histRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
    })
    histSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: histColumns.length } }
  }

  return await workbook.xlsx.writeBuffer()
}

function buildPdf(rows, profile, scope) {
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

  const pdfColumns = ['Statut', 'Nom', 'Prénom', 'Téléphone', 'Commune', 'Étape actuelle',
    'Intégrateur 1', 'Intégrateur 2', 'Dernier suivi effectué par', 'Prochaine action', 'Résultat', 'Priorité']

  const tableRows = rows.map(r => pdfColumns.map(c => String(r[c] ?? '')))

  autoTable(doc, {
    head: [pdfColumns],
    body: tableRows,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [7, 43, 106], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = rows[data.row.index]
        const colName = pdfColumns[data.column.index]
        if (colName === 'Priorité') {
          if (row._priority === 'Haute') data.cell.styles.fillColor = [254, 202, 202]
          else if (row._priority === 'Moyenne') data.cell.styles.fillColor = [254, 215, 170]
        }
        if (colName === 'Étape actuelle' && row._integre) data.cell.styles.fillColor = [187, 247, 208]
      }
    },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 8)
    },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
