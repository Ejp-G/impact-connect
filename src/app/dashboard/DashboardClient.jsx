'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { createClient } from '@/lib/supabase/client'
import TreatAlertModal from '@/components/dashboard/TreatAlertModal'
import { Users, Home, AlertCircle, CheckSquare, UserPlus, Phone, Compass, Clock, ArrowLeft, ChevronLeft, ChevronRight, Download, CheckCircle2, BookOpen, TrendingUp, TrendingDown } from '@/lib/icons'

const ACTIVITY_ICON_MAP = {
  new_contact: UserPlus,
  integration: Home,
  report: Phone,
  need: Compass,
}
const ACTIVITY_COLOR_MAP = {
  new_contact: '#0B3D91',
  integration: '#22C55E',
  report: '#3B82F6',
  need: '#F97316',
}
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc']
const MONTH_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function timeAgo(dateStr) {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (h < 1) return 'à l\'instant'
  if (h < 24) return `il y a ${Math.floor(h)}h`
  return `il y a ${Math.floor(h / 24)}j`
}

// Moyenne mobile sur 3 mois (fenêtre glissante, bornée aux extrémités)
// — c'est un calcul dérivé de données réelles, pas une donnée inventée.
// Sert uniquement de courbe de tendance visuelle sur le graphique.
function movingAverage(arr, window = 3) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(arr.length - 1, i + Math.floor(window / 2))
    const slice = arr.slice(start, end + 1)
    const sum = slice.reduce((s, v) => s + v, 0)
    return Math.round((sum / slice.length) * 10) / 10
  })
}

export default function DashboardClient({ stats, profile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const pieRef = useRef(null)
  const pieChartInstance = useRef(null)
  const growthRef = useRef(null)
  const growthChartInstance = useRef(null)

  const currentYear = new Date().getFullYear()
  const YEAR_OPTIONS = [currentYear - 5, currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear]
  const [viewYear, setViewYear] = useState(currentYear)
  const [yearData, setYearData] = useState(null) // null = utiliser stats (annee en cours), sinon {visitors:[], integrations:[], accueil:[]}
  const [prevYearTotal, setPrevYearTotal] = useState(null) // total visiteurs de l'année N-1, pour la carte "Progression"
  const [drillLevel, setDrillLevel] = useState('year')
  const [drillMonth, setDrillMonth] = useState(null)
  // NOUVEAU : source de la vue mensuelle en cours — 'visitors' (fiches
  // individuelles, table contacts) ou 'accueil' (comptage manuel par
  // culte, table cultes). Les deux séries n'ont pas la même nature :
  // Visiteurs ouvre une liste de personnes cliquables, Accueil ouvre
  // uniquement les totaux saisis par date de culte (pas de fiche
  // individuelle derrière un chiffre de comptage).
  const [drillSource, setDrillSource] = useState('visitors')
  const [drillDay, setDrillDay] = useState(null)
  const [drillDayContacts, setDrillDayContacts] = useState([])
  const [loadingDrill, setLoadingDrill] = useState(false)

  // Traitement d'alerte directement depuis le dashboard (sections 10-17)
  const [treatingTaskId, setTreatingTaskId] = useState(null)

  useRealtimeRefresh(['contacts', 'tasks', 'familles_impact'])

  // Charge les 12 mois d'une annee differente de l'annee en cours (celle-ci
  // est deja fournie via stats, calculee cote serveur au chargement initial).
  async function loadYear(year) {
    setLoadingDrill(true)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`
    const [{ data: visitorRows }, { data: integrationRows }, { data: cultesRows }] = await Promise.all([
      supabase.from('contacts').select('first_visit_date').gte('first_visit_date', yearStart).lt('first_visit_date', yearEnd),
      supabase.from('contacts').select('integrated_at').not('integrated_at', 'is', null).gte('integrated_at', yearStart).lt('integrated_at', yearEnd),
      supabase.from('cultes').select('date,nouveaux_comptes').gte('date', yearStart).lt('date', yearEnd),
    ])
    const visitors = Array(12).fill(0)
    visitorRows?.forEach(r => { if (r.first_visit_date) visitors[new Date(r.first_visit_date).getMonth()]++ })
    const integrations = Array(12).fill(0)
    integrationRows?.forEach(r => { integrations[new Date(r.integrated_at).getMonth()]++ })
    const accueil = Array(12).fill(0)
    cultesRows?.forEach(r => { if (r.nouveaux_comptes) accueil[new Date(r.date).getMonth()] += r.nouveaux_comptes })
    setYearData({ visitors, integrations, accueil })
    setLoadingDrill(false)
  }

  // Total visiteurs de l'année précédente — requête légère (count only),
  // uniquement pour calculer la progression réelle affichée sous le
  // graphique. Si l'année précédente n'a aucune donnée, la carte
  // "Progression" l'indique proprement plutôt que d'afficher un chiffre
  // inventé (section 28 : gérer le cas où l'année N-1 vaut 0 ou n'existe pas).
  async function loadPrevYearTotal(year) {
    const { count } = await supabase.from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('first_visit_date', `${year - 1}-01-01`)
      .lt('first_visit_date', `${year}-01-01`)
    setPrevYearTotal(count || 0)
  }

  function goToYear(year) {
    setViewYear(year)
    setDrillLevel('year'); setDrillMonth(null); setDrillDay(null); setDrillSource('visitors')
    if (year === currentYear) setYearData(null)
    else loadYear(year)
    loadPrevYearTotal(year)
  }

  useEffect(() => { loadPrevYearTotal(currentYear) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Vue mensuelle — deux sources possibles :
  // - 'visitors' : une ligne par jour où au moins un visiteur est arrivé
  //   (table contacts, cliquable ensuite pour voir les fiches du jour).
  // - 'accueil' : une ligne par date de culte où un comptage a été saisi
  //   (table cultes, nouveaux_comptes) — pas de drill jour par jour,
  //   puisqu'il n'y a pas de fiche individuelle derrière ce chiffre.
  async function openMonth(monthIndex, source = 'visitors') {
    setLoadingDrill(true)
    const start = new Date(viewYear, monthIndex, 1).toISOString().slice(0, 10)
    const end = new Date(viewYear, monthIndex + 1, 1).toISOString().slice(0, 10)

    if (source === 'accueil') {
      const { data } = await supabase.from('cultes')
        .select('date,nouveaux_comptes')
        .gte('date', start).lt('date', end)
      const sorted = (data || [])
        .filter(r => r.nouveaux_comptes != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => ({ date: r.date, count: r.nouveaux_comptes }))
      setDrillMonthData(sorted)
      setDrillSource('accueil')
      setDrillMonth(monthIndex)
      setDrillLevel('month')
      setLoadingDrill(false)
      return
    }

    const { data } = await supabase.from('contacts')
      .select('first_visit_date')
      .gte('first_visit_date', start).lt('first_visit_date', end)
    const counts = {}
    data?.forEach(r => { if (r.first_visit_date) counts[r.first_visit_date] = (counts[r.first_visit_date] || 0) + 1 })
    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
    setDrillMonthData(sorted)
    setDrillSource('visitors')
    setDrillMonth(monthIndex)
    setDrillLevel('month')
    setLoadingDrill(false)
  }

  const [drillMonthData, setDrillMonthData] = useState([])

  async function openDay(dateStr) {
    // Pas de drill jour par jour pour Comptage Accueil — voir commentaire
    // sur openMonth.
    if (drillSource !== 'visitors') return
    setLoadingDrill(true)
    const { data } = await supabase.from('contacts')
      .select('id,first_name,last_name,phone,commune,stage')
      .eq('first_visit_date', dateStr)
      .order('first_name')
    setDrillDayContacts(data || [])
    setDrillDay(dateStr)
    setDrillLevel('day')
    setLoadingDrill(false)
  }

  function backToYear() { setDrillLevel('year'); setDrillMonth(null); setDrillDay(null); setDrillSource('visitors') }
  function backToMonth() { setDrillLevel('month'); setDrillDay(null) }

  function downloadChartImage() {
    if (!growthChartInstance.current) return
    const url = growthChartInstance.current.toBase64Image()
    const link = document.createElement('a')
    link.href = url
    link.download = `croissance_${viewYear}${drillMonth !== null ? '_' + MONTH_FULL[drillMonth] : ''}.png`
    link.click()
  }

  function downloadChartCSV() {
    const rows = []
    if (drillLevel === 'year') {
      const visitorsData = yearData ? yearData.visitors : (stats.monthlyVisitors || Array(12).fill(0))
      const integrationsData = yearData ? yearData.integrations : (stats.monthlyIntegrations || Array(12).fill(0))
      const accueilData = yearData ? yearData.accueil : (stats.monthlyAccueil || Array(12).fill(0))
      rows.push('Mois,Visiteurs (formulaire),Intégrations FI,Comptage Accueil')
      MONTH_FULL.forEach((m, i) => rows.push(`${m},${visitorsData[i]},${integrationsData[i]},${accueilData[i]}`))
    } else if (drillLevel === 'month') {
      rows.push(drillSource === 'accueil' ? 'Date,Comptage Accueil' : 'Date,Visiteurs')
      drillMonthData.forEach(d => rows.push(`${d.date},${d.count}`))
    } else if (drillLevel === 'day') {
      rows.push('Prénom,Nom,Commune,Téléphone,Étape')
      drillDayContacts.forEach(c => rows.push(`${c.first_name},${c.last_name},${c.commune || ''},${c.phone || ''},${STAGE_LABEL(c.stage)}`))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `croissance_${viewYear}${drillMonth !== null ? '_' + MONTH_FULL[drillMonth] : ''}${drillDay ? '_' + drillDay : ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    let cancelled = false
    const loadPie = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled) return
      pieChartInstance.current?.destroy()
      if (pieRef.current) {
        const pieData = Object.entries(stats.stageCounts || {}).slice(0, 6)
        pieChartInstance.current = new Chart(pieRef.current, {
          type: 'doughnut',
          data: { labels: pieData.map(([s]) => STAGE_LABEL(s)), datasets: [{ data: pieData.map(([, v]) => v), backgroundColor: pieData.map(([s]) => STAGE_COLOR(s)), borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }
        })
      }
    }
    loadPie()
    return () => { cancelled = true; pieChartInstance.current?.destroy() }
  }, [stats])

  // Totaux réels de l'année affichée — base des cartes de synthèse
  // sous le graphique (section 27). Jamais de valeur inventée : si une
  // série n'a pas de données, son total est simplement 0.
  const visitorsData = yearData ? yearData.visitors : (stats.monthlyVisitors || Array(12).fill(0))
  const integrationsData = yearData ? yearData.integrations : (stats.monthlyIntegrations || Array(12).fill(0))
  const accueilData = yearData ? yearData.accueil : (stats.monthlyAccueil || Array(12).fill(0))
  const yearVisitorsTotal = visitorsData.reduce((s, v) => s + v, 0)
  const yearIntegrationsTotal = integrationsData.reduce((s, v) => s + v, 0)
  // Progression vs année précédente (section 28) : calcul réel uniquement
  // si l'année N-1 a des données ; sinon affichage neutre "—" plutôt
  // qu'un pourcentage fabriqué.
  const growthPct = (prevYearTotal !== null && prevYearTotal > 0)
    ? Math.round(((yearVisitorsTotal - prevYearTotal) / prevYearTotal) * 100)
    : null
  // NOUVEAU : la comparaison devient peu fiable si l'année précédente
  // n'a que très peu de données par rapport à l'année en cours — signe
  // probable d'une année de référence incomplète (migration, démarrage
  // de la saisie en cours d'année...) plutôt qu'une vraie explosion de
  // fréquentation. Seuil arbitraire mais raisonnable : N-1 < 20% de N.
  const growthUnreliable = growthPct !== null && prevYearTotal > 0 && prevYearTotal < yearVisitorsTotal * 0.2

  useEffect(() => {
    if (drillLevel === 'day') return
    let cancelled = false
    const loadGrowthChart = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled || !growthRef.current) return
      growthChartInstance.current?.destroy()

      if (drillLevel === 'year') {
        const trend = movingAverage(visitorsData, 3)
        growthChartInstance.current = new Chart(growthRef.current, {
          data: {
            labels: MONTH_SHORT,
            datasets: [
              {
                type: 'bar', label: 'Visiteurs', data: visitorsData,
                backgroundColor: '#4F46E5', borderRadius: { topLeft: 8, topRight: 8 },
                borderSkipped: false, order: 3, barPercentage: .7, categoryPercentage: .8
              },
              {
                type: 'bar', label: 'Intégrations FI', data: integrationsData,
                backgroundColor: '#16A34A', borderRadius: { topLeft: 8, topRight: 8 },
                borderSkipped: false, order: 3, barPercentage: .7, categoryPercentage: .8
              },
              {
                // Traité différemment des deux barres ci-dessus : ligne
                // fine + aire translucide plutôt qu'une 3e barre, car le
                // Comptage Accueil n'est pas de même nature (saisie
                // manuelle par culte, pas une fiche par personne). Aucun
                // point visible au repos — seulement au survol — pour un
                // rendu plus sobre. pointHitRadius élargi pour que le
                // clic reste détectable malgré pointRadius: 0.
                type: 'line', label: 'Comptage Accueil', data: accueilData,
                borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,.10)',
                borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12,
                pointHoverBackgroundColor: '#F97316', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
                tension: .4, cubicInterpolationMode: 'monotone', fill: true, order: 2
              },
              {
                type: 'line', label: 'Tendance', data: trend,
                borderColor: '#D4A017', borderWidth: 3, pointRadius: 0, pointHitRadius: 0,
                tension: .4, cubicInterpolationMode: 'monotone', fill: false, order: 1
              },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, elements) => {
              const bar = elements.find(e => e.datasetIndex <= 1)
              if (bar) { openMonth(bar.index, 'visitors'); return }
              // NOUVEAU : clic sur la ligne Comptage Accueil (datasetIndex
              // 2) — ouvre la vue mensuelle correspondante, sourcée sur
              // cultes plutôt que contacts.
              const accueilPoint = elements.find(e => e.datasetIndex === 2)
              if (accueilPoint) openMonth(accueilPoint.index, 'accueil')
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 18, font: { size: 12, weight: '600' } }
              },
              tooltip: {
                backgroundColor: '#1E293B', padding: 12, cornerRadius: 10,
                titleFont: { size: 13, weight: '700' }, bodyFont: { size: 12 }, bodySpacing: 4,
                callbacks: { title: (items) => `${MONTH_FULL[items[0].dataIndex]} ${viewYear}` }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' }, color: '#64748B' } },
              y: { grid: { color: '#F1F5F9' }, beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1, precision: 0 } }
            }
          }
        })
      } else if (drillLevel === 'month') {
        const isAccueil = drillSource === 'accueil'
        growthChartInstance.current = new Chart(growthRef.current, {
          type: 'bar',
          data: {
            labels: drillMonthData.map(d => new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })),
            datasets: [{
              label: isAccueil ? 'Comptage Accueil' : 'Visiteurs',
              data: drillMonthData.map(d => d.count),
              backgroundColor: isAccueil ? '#F9731680' : '#0B3D9180',
              borderColor: isAccueil ? '#F97316' : '#0B3D91',
              borderWidth: 1.5, borderRadius: 6
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            // Pas de drill jour par jour pour Comptage Accueil — voir
            // commentaire sur openDay.
            onClick: (evt, elements) => { if (isAccueil) return; if (elements.length) openDay(drillMonthData[elements[0].index].date) },
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { grid: { color: '#F1F5F9' }, beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1, precision: 0 } }
            }
          }
        })
      }
    }
    loadGrowthChart()
    return () => { cancelled = true; growthChartInstance.current?.destroy() }
  }, [drillLevel, drillMonth, drillMonthData, drillSource, yearData, stats.monthlyVisitors, stats.monthlyIntegrations, stats.monthlyAccueil, viewYear])

  const firstName = profile?.name?.split(' ')[0] || 'Pasteur'

  const statCards = [
    { Icon: Users, label: 'Total contacts', value: stats.totalContacts || 0, color: '#0B3D91', sub: null, href: '/visiteurs' },
    { Icon: Home, label: "Familles d'Impact", value: stats.fiData?.length || 0, color: '#22C55E', sub: stats.fiPausedCount > 0 ? `dont ${stats.fiPausedCount} en pause` : null, href: '/fi' },
    { Icon: AlertCircle, label: 'Alertes urgentes', value: stats.alertsRed || 0, color: '#EF4444', sub: null, href: '/visiteurs?filter=alert' },
    { Icon: CheckSquare, label: 'Tâches en attente', value: stats.pendingTasks || 0, color: '#F97316', sub: null, href: '/suivi?tab=taches' },
  ]

  const todayChecklist = [
    `${stats.pendingTasks || 0} tâche${stats.pendingTasks === 1 ? '' : 's'} en attente`,
    `${stats.newToday || 0} nouveau${stats.newToday === 1 ? '' : 'x'} visiteur${stats.newToday === 1 ? '' : 's'} aujourd'hui`,
    `${stats.alertsRed || 0} urgence${stats.alertsRed === 1 ? '' : 's'}`,
    stats.fiTonight ? `Prochaine FI ce soir à ${stats.fiTonight.time} (${stats.fiTonight.name})` : null,
  ].filter(Boolean)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:1200 }}>
      {stats.overdueTasks && stats.overdueTasks.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:14, padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'#DC2626', fontSize:14, marginBottom:8 }}>
            <AlertCircle size={16} strokeWidth={2} color="#DC2626" />
            {stats.overdueTasks.length} tâche{stats.overdueTasks.length>1?'s':''} en retard
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {stats.overdueTasks.slice(0,5).map(t => (
              <div key={t.id} style={{ fontSize:13, color:'#991B1B', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span>
                  Vous devez contacter <b>{t.contact?.first_name} {t.contact?.last_name}</b> — {t.title || t.type} (échéance : {t.due_date})
                  {stats.overdueIsTeamWide && t.assignee?.name && <span> · <i>{t.assignee.name}</i></span>}
                </span>
                <button onClick={() => setTreatingTaskId(t.id)} style={treatBtnStyle}>✓ Traiter</button>
              </div>
            ))}
            {stats.overdueTasks.length > 5 && (
              <div style={{ fontSize:12, color:'#991B1B', fontStyle:'italic' }}>+ {stats.overdueTasks.length - 5} autre(s), voir Suivi &amp; Tâches</div>
            )}
          </div>
        </div>
      )}

      {stats.toRelaunchTasks && stats.toRelaunchTasks.length > 0 && (
        <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:14, padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'#475569', fontSize:14, marginBottom:6 }}>
            <BookOpen size={16} strokeWidth={2} color="#64748B" />
            {stats.toRelaunchTasks.length} personne{stats.toRelaunchTasks.length>1?'s':''} à relancer
          </div>
          <div style={{ fontSize:12, color:'#64748B', fontStyle:'italic', marginBottom:10 }}>
            Ces personnes n'ont pas été oubliées — ce n'est pas urgent, juste une reprise de contact à programmer quand vous avez un moment.
          </div>
          <button onClick={() => router.push('/suivi?tab=mission')} style={{ ...backBtnStyle, background:'#fff', border:'1px solid #E2E8F0' }}>
            Voir dans Suivi &amp; Tâches
          </button>
        </div>
      )}

      {(stats.myContactsCount > 0 || stats.myTasksToday?.length > 0) && (
        <div className="card" style={{ borderLeft: '4px solid #0B3D91' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>👤 Mon espace de suivi</div>
              <div style={{ fontSize:13, color:'var(--gy)' }}>
                Vous suivez <b style={{ color:'#0B3D91' }}>{stats.myContactsCount}</b> visiteur(s), dont <b style={{ color:'#F97316' }}>{stats.myTasksToday?.length || 0}</b> tâche(s) à faire aujourd'hui.
              </div>
            </div>
            <button onClick={() => router.push('/visiteurs?filter=mine')} style={{ ...backBtnStyle, background:'#0B3D91', color:'#fff' }}>Voir mes visiteurs</button>
          </div>
          {stats.myTasksToday?.length > 0 && (
            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:6 }}>
              {stats.myTasksToday.slice(0,4).map(t => (
                <div key={t.id} style={{ fontSize:12, color:'var(--gd)' }}>
                  <b>{t.contact?.first_name} {t.contact?.last_name}</b> — {t.title || t.type}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background:'linear-gradient(135deg,#072B6A 0%,#0B3D91 55%,#1452B5 100%)', borderRadius:22, padding:'32px 32px', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div className="hero-circle" style={{ position:'absolute', top:-50, right:-30, width:220, height:220, borderRadius:'50%', border:'1px solid rgba(255,255,255,.1)' }} />
        <div className="hero-circle" style={{ position:'absolute', bottom:-70, right:120, width:140, height:140, borderRadius:'50%', border:'1px solid rgba(255,255,255,.07)', animationDelay:'1.5s' }} />
        <div className="hero-circle" style={{ position:'absolute', top:30, left:'55%', width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.05)', animationDelay:'3s' }} />

        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Bonjour, {firstName} 👋</div>
          <div style={{ fontSize:14, opacity:.75, marginBottom:22 }}>Bienvenue sur votre espace de pilotage.</div>

          <div className="hero-glass" style={{ borderRadius:16, padding:'18px 20px', maxWidth:420, marginBottom:22 }}>
            <div style={{ fontSize:11, opacity:.7, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Aujourd'hui</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {todayChecklist.map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:10 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="g4" style={{ gap:12 }}>
            {[
              ['Visiteurs ce mois', stats.newThisMonth || 0, '↑', '/visiteurs?filter=new'],
              ['Intégrations', stats.stageCounts?.integre || 0, '↑', '/pipeline?etape=integre'],
              ['Appels au salut', stats.salvations || 0, '↑', '/visiteurs?filter=salvation'],
              ['Tâches en attente', stats.pendingTasks || 0, '', '/suivi?tab=taches'],
            ].map(([lb,v,ch,href])=>(
              <div key={lb} onClick={() => router.push(href)} style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}>
                <div style={{ fontSize:11, opacity:.7, marginBottom:4, fontWeight:500 }}>{lb}</div>
                <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-.5px' }}>{v}</div>
                {ch && <div style={{ fontSize:11, color:'#86EFAC', marginTop:2 }}>{ch} ce mois</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="g4">
        {statCards.map(({ Icon, label, value, color, sub, href }) => (
          <div key={label} onClick={() => router.push(href)} className="card stat-halo" style={{ padding:20, borderTop:`3px solid ${color}`, '--halo-color': color+'22', cursor:'pointer', transition:'transform .15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'relative', zIndex:1 }}>
              <div>
                <div style={{ fontSize:13, color:'#64748B', fontWeight:500, marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:32, fontWeight:800, color:'#1E293B', letterSpacing:-1 }}>{value}</div>
                {sub && <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{sub}</div>}
              </div>
              <div style={{ width:44, height:44, borderRadius:12, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={20} strokeWidth={2} color="#fff" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.culteCheck && (() => {
        const cc = stats.culteCheck
        const nouveauxDiff = cc.nouveauxComptes != null ? cc.nouveauxComptes - cc.nouveauxReels : 0
        const salutDiff = cc.salutComptes != null ? cc.salutComptes - cc.salutReels : 0
        const isConsistent = nouveauxDiff === 0 && salutDiff === 0
        const issues = []
        if (nouveauxDiff > 0) issues.push(`${nouveauxDiff} nouveau${nouveauxDiff > 1 ? 'x' : ''} visiteur${nouveauxDiff > 1 ? 's' : ''} non enregistré${nouveauxDiff > 1 ? 's' : ''}`)
        if (nouveauxDiff < 0) issues.push(`${-nouveauxDiff} visiteur${-nouveauxDiff > 1 ? 's' : ''} enregistré${-nouveauxDiff > 1 ? 's' : ''} en plus du compte Accueil`)
        if (salutDiff > 0) issues.push(`${salutDiff} appel${salutDiff > 1 ? 's' : ''} au salut non enregistré${salutDiff > 1 ? 's' : ''}`)
        if (salutDiff < 0) issues.push(`${-salutDiff} appel${-salutDiff > 1 ? 's' : ''} au salut en plus du compte Accueil`)

        return (
          <div className="card" style={{ borderLeft: `4px solid ${isConsistent ? '#22C55E' : '#F97316'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  {isConsistent ? <CheckCircle2 size={16} strokeWidth={2} color="#22C55E" /> : <AlertCircle size={16} strokeWidth={2} color="#F97316" />}
                  Vérification du dernier culte — {new Date(cc.date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:13, color: isConsistent ? '#16A34A' : '#C2410C', marginTop:6, fontWeight:600 }}>
                  {isConsistent ? 'Toutes les données sont cohérentes.' : `Il manque : ${issues.join(', ')}`}
                </div>
              </div>
              <div style={{ display:'flex', gap:20, fontSize:12 }}>
                <div>
                  <div style={{ color:'var(--gy)' }}>Présents</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{cc.presents ?? '—'}</div>
                </div>
                <div>
                  <div style={{ color:'var(--gy)' }}>Nouveaux (Accueil / réel)</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{cc.nouveauxComptes ?? '—'} / {cc.nouveauxReels}</div>
                </div>
                <div>
                  <div style={{ color:'var(--gy)' }}>Appels au salut (Accueil / réel)</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{cc.salutComptes ?? '—'} / {cc.salutReels}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="g2r">
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card" style={{ border: '1px solid #F1F5F9' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:'#1E293B' }}>Croissance annuelle</div>
                <div style={{ fontSize:12, color:'var(--gy)', marginTop:2 }}>Suivez l'évolution de vos visiteurs et intégrations</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {drillLevel !== 'day' && (
                  <button onClick={downloadChartImage} style={backBtnStyle} title="Télécharger en image">
                    <Download size={12} strokeWidth={2} /> PNG
                  </button>
                )}
                <button onClick={downloadChartCSV} style={backBtnStyle} title="Télécharger les données">
                  <Download size={12} strokeWidth={2} /> CSV
                </button>
                {drillLevel !== 'year' && (
                  <button onClick={drillLevel === 'day' ? backToMonth : backToYear} style={backBtnStyle}>
                    <ArrowLeft size={12} strokeWidth={2} /> Retour
                  </button>
                )}
              </div>
            </div>

            {/* Sélecteur d'année en pills (section 23) */}
            {drillLevel === 'year' && (
              <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
                {YEAR_OPTIONS.map(y => (
                  <button key={y} onClick={() => goToYear(y)} style={{
                    padding:'6px 14px', borderRadius:999, border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:700,
                    background: y === viewYear ? 'var(--n)' : '#F1F5F9',
                    color: y === viewYear ? '#fff' : '#64748B',
                    transition:'background .15s'
                  }}>
                    {y}
                  </button>
                ))}
              </div>
            )}

            {drillMonth !== null && drillLevel !== 'year' && (
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, marginBottom:10 }}>
                <span onClick={backToYear} style={{ cursor:'pointer', color:'var(--gy)' }}>{viewYear}</span>
                <span style={{ color:'var(--gy)' }}>›</span>
                <span onClick={backToMonth} style={{ cursor:'pointer', fontWeight: drillLevel==='month'?700:400, color: drillLevel==='month'?'var(--n)':'var(--gy)' }}>
                  {MONTH_FULL[drillMonth]}{drillSource === 'accueil' ? ' · Comptage Accueil' : ''}
                </span>
                {drillDay && (
                  <>
                    <span style={{ color:'var(--gy)' }}>›</span>
                    <span style={{ fontWeight:700, color:'var(--n)' }}>
                      {new Date(drillDay).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                    </span>
                  </>
                )}
              </div>
            )}

            {loadingDrill ? (
              <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gy)', fontSize:13 }}>Chargement…</div>
            ) : drillLevel === 'day' ? (
              <div style={{ maxHeight:260, overflowY:'auto' }}>
                {drillDayContacts.length === 0 ? (
                  <div style={{ padding:'30px 0', textAlign:'center', color:'var(--gy)', fontSize:13 }}>Aucun visiteur ce jour-là.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {drillDayContacts.map(c => (
                      <div key={c.id} onClick={() => router.push(`/visiteurs/${c.id}`)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#F8FAFC', borderRadius:8, cursor:'pointer' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{c.first_name} {c.last_name}</div>
                          <div style={{ fontSize:11, color:'var(--gy)' }}>{c.commune || '—'}{c.phone ? ` · ${c.phone}` : ''}</div>
                        </div>
                        <span className="badge" style={{ background:STAGE_COLOR(c.stage)+'20', color:STAGE_COLOR(c.stage), fontSize:10 }}>{STAGE_LABEL(c.stage)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : drillLevel === 'month' && drillSource === 'accueil' ? (
              <>
                <div style={{ height:260 }}><canvas ref={growthRef} /></div>
                {!loadingDrill && drillMonthData.length === 0 && (
                  <div style={{ padding:'12px 0 0', textAlign:'center', color:'var(--gy)', fontSize:12 }}>
                    Aucun comptage Accueil saisi pour ce mois.
                  </div>
                )}
                <div style={{ fontSize:11, color:'#94A3B8', marginTop:10, textAlign:'center' }}>
                  Total du mois : <b style={{ color:'#C2410C' }}>{drillMonthData.reduce((s, d) => s + d.count, 0)}</b> — comptage manuel par culte, pas de fiches individuelles à afficher.
                </div>
              </>
            ) : (
              <div style={{ height:260 }}><canvas ref={growthRef} /></div>
            )}

            {/* Cartes de synthèse (section 27) — uniquement en vue année,
                jamais de chiffre inventé : "—" si la donnée n'est pas
                disponible plutôt qu'un pourcentage fabriqué. */}
            {drillLevel === 'year' && !loadingDrill && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:10, marginTop:18, paddingTop:18, borderTop:'1px solid #F1F5F9' }}>
                <SummaryCard label="Visiteurs cette année" value={yearVisitorsTotal} color="#0B3D91" />
                <SummaryCard label="Intégrations FI" value={yearIntegrationsTotal} color="#22C55E" />
                <SummaryCard
                  label="Progression"
                  value={growthPct === null ? '—' : `${growthPct > 0 ? '+' : ''}${growthPct}%`}
                  color={growthPct === null ? '#94A3B8' : growthPct >= 0 ? '#16A34A' : '#DC2626'}
                  icon={growthPct === null ? null : growthPct >= 0 ? TrendingUp : TrendingDown}
                  sub={
                    prevYearTotal === null ? null :
                    growthUnreliable ? `vs ${viewYear - 1} (${prevYearTotal}) — comparaison peu fiable, année de référence incomplète` :
                    `vs ${viewYear - 1} (${prevYearTotal})`
                  }
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card">
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Répartition Pipeline</div>
            <div style={{ fontSize:12, color:'var(--gy)', marginBottom:12 }}>Par étape</div>
            <div style={{ height:160 }}><canvas ref={pieRef} /></div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginTop:10 }}>
              {Object.entries(stats.stageCounts||{}).map(([stage, count])=>(
                <div key={stage} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:STAGE_COLOR(stage) }} />
                  <span style={{ fontSize:11, color:'var(--gd)' }}>{STAGE_LABEL(stage)} ({count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Activité récente</div>
        {(!stats.activityFeed || stats.activityFeed.length === 0) ? (
          <div style={{ fontSize:13, color:'var(--gy)', textAlign:'center', padding:'20px 0' }}>Aucune activité récente.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {stats.activityFeed.map((a, i) => {
              const Icon = ACTIVITY_ICON_MAP[a.type] || Clock
              const color = ACTIVITY_COLOR_MAP[a.type] || '#94A3B8'
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < stats.activityFeed.length-1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon size={15} strokeWidth={2} color={color} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1E293B' }}>{a.name || '—'}</div>
                    <div style={{ fontSize:11, color:'var(--gy)' }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize:11, color:'#CBD5E1', flexShrink:0 }}>{timeAgo(a.date)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <Home size={17} strokeWidth={2} color="var(--n)" /> Familles d'Impact — Capacité
        </div>
        <div className="g3">
          {stats.fiData?.map(fi => {
            const mb = stats.fiMemberCounts?.[fi.id] || 0
            const pct = Math.round((mb / fi.capacity) * 100)
            return (
              <div key={fi.id} style={{ padding:'12px 16px', background:'#F8FAFC', borderRadius:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{fi.name}</span>
                  <span style={{ fontSize:12, color:pct>85?'var(--or)':'var(--gr)', fontWeight:700 }}>{mb}/{fi.capacity}</span>
                </div>
                <div style={{ height:6, background:'#E2E8F0', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:pct>85?'var(--or)':'var(--gr)', borderRadius:3, transition:'width .5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {treatingTaskId && (
        <TreatAlertModal taskId={treatingTaskId} onClose={() => setTreatingTaskId(null)} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div style={{ background:'#F8FAFC', borderRadius:12, padding:'12px 14px' }}>
      <div style={{ fontSize:11, color:'#94A3B8', fontWeight:600, marginBottom:4 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {Icon && <Icon size={14} strokeWidth={2.5} color={color} />}
        <span style={{ fontSize:20, fontWeight:800, color }}>{value}</span>
      </div>
      {sub && <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

const backBtnStyle = {
  display:'flex', alignItems:'center', gap:5, background:'#F1F5F9', border:'none',
  borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, color:'#64748B', cursor:'pointer'
}
const treatBtnStyle = {
  background:'#fff', color:'#DC2626', border:'1px solid #FCA5A5', borderRadius:8,
  padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0
}
