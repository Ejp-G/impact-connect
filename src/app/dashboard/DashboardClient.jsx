'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { createClient } from '@/lib/supabase/client'
import { Users, Home, AlertCircle, CheckSquare, UserPlus, Phone, Compass, Clock, ArrowLeft, ChevronLeft, ChevronRight, Download, CheckCircle2 } from '@/lib/icons'

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
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const MONTH_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function timeAgo(dateStr) {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (h < 1) return 'à l\'instant'
  if (h < 24) return `il y a ${Math.floor(h)}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function DashboardClient({ stats, profile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const pieRef = useRef(null)
  const pieChartInstance = useRef(null)
  const growthRef = useRef(null)
  const growthChartInstance = useRef(null)

  const currentYear = new Date().getFullYear()
  const [viewYear, setViewYear] = useState(currentYear)
  const [yearData, setYearData] = useState(null) // null = utiliser stats (annee en cours), sinon {visitors:[], integrations:[]}
  const [drillLevel, setDrillLevel] = useState('year')
  const [drillMonth, setDrillMonth] = useState(null)
  const [drillMonthData, setDrillMonthData] = useState([])
  const [drillDay, setDrillDay] = useState(null)
  const [drillDayContacts, setDrillDayContacts] = useState([])
  const [loadingDrill, setLoadingDrill] = useState(false)

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

  function goToYear(year) {
    setViewYear(year)
    setDrillLevel('year'); setDrillMonth(null); setDrillDay(null)
    if (year === currentYear) setYearData(null)
    else loadYear(year)
  }

  async function openMonth(monthIndex) {
    setLoadingDrill(true)
    const start = new Date(viewYear, monthIndex, 1).toISOString().slice(0, 10)
    const end = new Date(viewYear, monthIndex + 1, 1).toISOString().slice(0, 10)
    const { data } = await supabase.from('contacts')
      .select('first_visit_date')
      .gte('first_visit_date', start).lt('first_visit_date', end)
    const counts = {}
    data?.forEach(r => { if (r.first_visit_date) counts[r.first_visit_date] = (counts[r.first_visit_date] || 0) + 1 })
    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
    setDrillMonthData(sorted)
    setDrillMonth(monthIndex)
    setDrillLevel('month')
    setLoadingDrill(false)
  }

  async function openDay(dateStr) {
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

  function backToYear() { setDrillLevel('year'); setDrillMonth(null); setDrillDay(null) }
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
      rows.push('Date,Visiteurs')
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

  useEffect(() => {
    if (drillLevel === 'day') return
    let cancelled = false
    const loadGrowthChart = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled || !growthRef.current) return
      growthChartInstance.current?.destroy()

      if (drillLevel === 'year') {
        const visitorsData = yearData ? yearData.visitors : (stats.monthlyVisitors || Array(12).fill(0))
        const integrationsData = yearData ? yearData.integrations : (stats.monthlyIntegrations || Array(12).fill(0))
        const accueilData = yearData ? yearData.accueil : (stats.monthlyAccueil || Array(12).fill(0))
        growthChartInstance.current = new Chart(growthRef.current, {
          type: 'line',
          data: {
            labels: MONTH_SHORT,
            datasets: [
              { label: 'Visiteurs (formulaire)', data: visitorsData, borderColor: '#0B3D91', backgroundColor: 'rgba(11,61,145,.08)', fill: true, tension: .4, borderWidth: 2 },
              { label: 'Intégrations FI', data: integrationsData, borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,.05)', fill: true, tension: .4, borderWidth: 2 },
              { label: 'Comptage Accueil', data: accueilData, borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,.04)', fill: true, tension: .4, borderWidth: 2, borderDash: [5, 4] },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, elements) => { if (elements.length) openMonth(elements[0].index) },
            plugins: { legend: { labels: { font: { size: 11 } } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { grid: { color: '#F1F5F9' }, beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1, precision: 0 } }
            }
          }
        })
      } else if (drillLevel === 'month') {
        growthChartInstance.current = new Chart(growthRef.current, {
          type: 'bar',
          data: {
            labels: drillMonthData.map(d => new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })),
            datasets: [{ label: 'Visiteurs', data: drillMonthData.map(d => d.count), backgroundColor: '#0B3D9180', borderColor: '#0B3D91', borderWidth: 1.5, borderRadius: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, elements) => { if (elements.length) openDay(drillMonthData[elements[0].index].date) },
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
  }, [drillLevel, drillMonth, drillMonthData, yearData, stats.monthlyVisitors, stats.monthlyIntegrations, stats.monthlyAccueil])

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
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {stats.overdueTasks.slice(0,5).map(t => (
              <div key={t.id} style={{ fontSize:13, color:'#991B1B' }}>
                Vous devez contacter <b>{t.contact?.first_name} {t.contact?.last_name}</b> — {t.title || t.type} (échéance : {t.due_date})
                {stats.overdueIsTeamWide && t.assignee?.name && <span> · <i>{t.assignee.name}</i></span>}
              </div>
            ))}
            {stats.overdueTasks.length > 5 && (
              <div style={{ fontSize:12, color:'#991B1B', fontStyle:'italic' }}>+ {stats.overdueTasks.length - 5} autre(s), voir Suivi &amp; Tâches</div>
            )}
          </div>
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

      {/* Verification du dernier culte (Module Accueil) */}
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
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>Croissance annuelle</div>
                <div style={{ fontSize:12, color:'var(--gy)' }}>Cliquez un mois, puis un jour, pour voir le détail</div>
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

            {drillLevel === 'year' && (
              <div style={{ fontSize:11, color:'var(--gy)', background:'#F8FAFC', borderRadius:8, padding:'8px 10px', marginBottom:4, lineHeight:1.5 }}>
                <b style={{ color:'#0B3D91' }}>Visiteurs (formulaire)</b> : fiches réellement créées, selon leur date de première visite.{' '}
                <b style={{ color:'#22C55E' }}>Intégrations FI</b> : personnes ayant rejoint une Famille d'Impact ce mois-là.{' '}
                <b style={{ color:'#F97316' }}>Comptage Accueil</b> : nouveaux comptés à l'entrée (Module Accueil), peut différer si des personnes reperées ne remplissent jamais de fiche. Cliquez une ligne dans la légende pour l'afficher/la masquer.
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, margin:'10px 0' }}>
              <button onClick={() => goToYear(viewYear - 1)} style={yearNavBtnStyle} title="Année précédente">
                <ChevronLeft size={12} strokeWidth={2} />
              </button>
              <span onClick={backToYear} style={{ cursor:'pointer', fontWeight: drillLevel==='year'?700:400, color: drillLevel==='year'?'var(--n)':'var(--gy)' }}>{viewYear}</span>
              <button onClick={() => goToYear(viewYear + 1)} style={yearNavBtnStyle} title="Année suivante">
                <ChevronRight size={12} strokeWidth={2} />
              </button>
              {drillMonth !== null && (
                <>
                  <span style={{ color:'var(--gy)' }}>›</span>
                  <span onClick={backToMonth} style={{ cursor:'pointer', fontWeight: drillLevel==='month'?700:400, color: drillLevel==='month'?'var(--n)':'var(--gy)' }}>{MONTH_FULL[drillMonth]}</span>
                </>
              )}
              {drillDay && (
                <>
                  <span style={{ color:'var(--gy)' }}>›</span>
                  <span style={{ fontWeight:700, color:'var(--n)' }}>
                    {new Date(drillDay).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                  </span>
                </>
              )}
            </div>

            {loadingDrill ? (
              <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gy)', fontSize:13 }}>Chargement…</div>
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
            ) : (
              <div style={{ height:220 }}><canvas ref={growthRef} /></div>
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
    </div>
  )
}

const backBtnStyle = {
  display:'flex', alignItems:'center', gap:5, background:'#F1F5F9', border:'none',
  borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:600, color:'#64748B', cursor:'pointer'
}
const yearNavBtnStyle = {
  display:'flex', alignItems:'center', justifyContent:'center', width:20, height:20,
  background:'#F1F5F9', border:'none', borderRadius:6, color:'#64748B', cursor:'pointer', padding:0
}
