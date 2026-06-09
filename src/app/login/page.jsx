'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage({ searchParams }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(searchParams?.error === 'inactive' ? 'Votre compte est désactivé. Contactez votre administrateur.' : '')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : authError.message)
      setLoading(false)
      return
    }

    // Vérifier compte actif
    const { data: { session } } = await supabase.auth.getSession()
    const { data: profile } = await supabase.from('profiles').select('active,role').eq('id', session.user.id).single()

    if (!profile?.active) {
      await supabase.auth.signOut()
      setError('Votre compte est désactivé. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {/* GAUCHE — Branding */}
      <div style={{ width:'45%', background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 60%,#1452B5 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', border:'2px solid rgba(255,255,255,.08)' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', border:'1px solid rgba(255,255,255,.06)' }} />
        <div style={{ opacity:.9 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <rect x="24" y="4" width="12" height="52" rx="6" fill="rgba(255,255,255,.9)"/>
            <rect x="4" y="20" width="52" height="12" rx="6" fill="rgba(255,255,255,.9)"/>
          </svg>
        </div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:38, color:'#fff', textAlign:'center', lineHeight:1.1, fontWeight:700, marginTop:24 }}>
          IMPACT<br/>CONNECT
        </div>
        <div style={{ color:'rgba(255,255,255,.6)', fontSize:13, marginTop:8, letterSpacing:.5 }}>
          Plateforme d'Intégration & de Suivi
        </div>
        <div style={{ marginTop:56, display:'flex', flexDirection:'column', gap:16, width:'100%', maxWidth:280 }}>
          {[['✓','Zéro oubli','Suivi automatisé de chaque visiteur'],['🏠',"Familles d'Impact",'Attribution intelligente par commune'],['📈','Croissance mesurée','Statistiques en temps réel']].map(([ic,t1,t2])=>(
            <div key={t1} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{ic}</div>
              <div>
                <div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{t1}</div>
                <div style={{ color:'rgba(255,255,255,.5)', fontSize:11 }}>{t2}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DROITE — Formulaire */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background:'#F8FAFC' }}>
        <div style={{ width:'100%', maxWidth:380 }}>
          <div style={{ fontSize:28, fontWeight:800, color:'#1E293B', letterSpacing:'-.5px' }}>Bon retour 👋</div>
          <div style={{ color:'#475569', fontSize:14, marginTop:6, marginBottom:36 }}>Connectez-vous à votre espace</div>

          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#DC2626', fontWeight:500 }}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label className="form-label">Adresse email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                className="form-input" placeholder="votre@email.com" required
                autoComplete="email" />
            </div>
            <div style={{ marginBottom:24 }}>
              <label className="form-label">Mot de passe</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                className="form-input" placeholder="••••••••" required
                autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} style={{
              width:'100%', padding:14, borderRadius:12, border:'none', cursor:loading?'not-allowed':'pointer',
              background:'linear-gradient(135deg,#0B3D91 0%,#1452B5 100%)',
              color:'#fff', fontFamily:'inherit', fontSize:15, fontWeight:700,
              boxShadow:'0 4px 20px rgba(11,61,145,.35)', opacity:loading?.7:1
            }}>
              {loading ? '⏳ Connexion…' : '🔐 Connexion sécurisée'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:20, color:'#94A3B8', fontSize:12 }}>
            🔒 Accès sécurisé — Données chiffrées — RGPD
          </div>
        </div>
      </div>
    </div>
  )
}
