'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage({ searchParams }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(
    searchParams?.error === 'inactive'
      ? 'Votre compte est desactive. Contactez votre administrateur.'
      : ''
  )
  const [resetMode, setResetMode]     = useState(false)
  const [resetSent, setResetSent]     = useState(false)
  const [resetEmail, setResetEmail]   = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const router  = useRouter()
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
    const { data: { session } } = await supabase.auth.getSession()
    const { data: profile } = await supabase.from('profiles').select('active,role').eq('id', session.user.id).single()
    if (!profile?.active) {
      await supabase.auth.signOut()
      setError('Votre compte est desactive. Contactez votre administrateur.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    if (!resetEmail) { setError('Entrez votre adresse email.'); return }
    setResetLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    setResetLoading(false)
    if (err) { setError(err.message); return }
    setResetSent(true)
  }

  // Ecran confirmation envoi email
  if (resetSent) return (
    <div style={{display:'flex',height:'100vh',fontFamily:"'Plus Jakarta Sans',sans-serif",alignItems:'center',justifyContent:'center',background:'#F8FAFC'}}>
      <div style={{background:'#fff',borderRadius:24,padding:48,textAlign:'center',maxWidth:400,boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
        <div style={{fontSize:56,marginBottom:16}}>📧</div>
        <div style={{fontSize:22,fontWeight:800,color:'#1E293B',marginBottom:12}}>Email envoye !</div>
        <div style={{fontSize:14,color:'#64748B',lineHeight:1.6,marginBottom:24}}>
          Un lien de reinitialisation a ete envoye a <strong>{resetEmail}</strong>.<br/>
          Cliquez sur le lien dans l email pour definir un nouveau mot de passe.
        </div>
        <div style={{fontSize:12,color:'#94A3B8',marginBottom:24}}>
          Verifiez aussi vos spams si vous ne le recevez pas dans 2 minutes.
        </div>
        <button onClick={()=>{setResetMode(false);setResetSent(false);setResetEmail('')}}
          style={{padding:'12px 24px',borderRadius:12,border:'none',cursor:'pointer',background:'#0B3D91',color:'#fff',fontFamily:'inherit',fontSize:14,fontWeight:700}}>
          Retour a la connexion
        </button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* GAUCHE */}
      <div style={{width:'45%',background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 60%,#1452B5 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:'50%',border:'2px solid rgba(255,255,255,.08)'}} />
        <div style={{position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',border:'1px solid rgba(255,255,255,.06)'}} />
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{opacity:.9}}>
          <rect x="24" y="4" width="12" height="52" rx="6" fill="rgba(255,255,255,.9)"/>
          <rect x="4" y="20" width="52" height="12" rx="6" fill="rgba(255,255,255,.9)"/>
        </svg>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:38,color:'#fff',textAlign:'center',lineHeight:1.1,fontWeight:700,marginTop:24}}>
          IMPACT<br/>CONNECT
        </div>
        <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginTop:8,letterSpacing:.5}}>
          Plateforme Integration et Suivi
        </div>
        <div style={{marginTop:56,display:'flex',flexDirection:'column',gap:16,width:'100%',maxWidth:280}}>
          {[['✓','Zero oubli','Suivi automatise de chaque visiteur'],['🏠',"Familles d'Impact",'Attribution intelligente par commune'],['📈','Croissance mesuree','Statistiques en temps reel']].map(([ic,t1,t2])=>(
            <div key={t1} style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{ic}</div>
              <div>
                <div style={{color:'#fff',fontSize:13,fontWeight:600}}>{t1}</div>
                <div style={{color:'rgba(255,255,255,.5)',fontSize:11}}>{t2}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DROITE */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:48,background:'#F8FAFC'}}>
        <div style={{width:'100%',maxWidth:380}}>

          {!resetMode ? (
            <>
              <div style={{fontSize:28,fontWeight:800,color:'#1E293B',letterSpacing:'-.5px'}}>Bon retour 👋</div>
              <div style={{color:'#475569',fontSize:14,marginTop:6,marginBottom:36}}>Connectez-vous a votre espace</div>

              {error && (
                <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#DC2626',fontWeight:500}}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Adresse email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'2px solid #E2E8F0',fontFamily:'inherit',fontSize:14,outline:'none',boxSizing:'border-box'}}
                    onFocus={e=>e.target.style.borderColor='#0B3D91'}
                    onBlur={e=>e.target.style.borderColor='#E2E8F0'}
                    placeholder="votre@email.com" required autoComplete="email" />
                </div>
                <div style={{marginBottom:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Mot de passe</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'2px solid #E2E8F0',fontFamily:'inherit',fontSize:14,outline:'none',boxSizing:'border-box'}}
                    onFocus={e=>e.target.style.borderColor='#0B3D91'}
                    onBlur={e=>e.target.style.borderColor='#E2E8F0'}
                    placeholder="••••••••" required autoComplete="current-password" />
                </div>

                {/* Lien mot de passe oublié */}
                <div style={{textAlign:'right',marginBottom:24}}>
                  <span onClick={()=>{setResetMode(true);setError('');setResetEmail(email)}}
                    style={{fontSize:12,color:'#0B3D91',cursor:'pointer',fontWeight:600,textDecoration:'underline'}}>
                    Mot de passe oublie ?
                  </span>
                </div>

                <button type="submit" disabled={loading}
                  style={{width:'100%',padding:14,borderRadius:12,border:'none',cursor:loading?'not-allowed':'pointer',background:'linear-gradient(135deg,#0B3D91 0%,#1452B5 100%)',color:'#fff',fontFamily:'inherit',fontSize:15,fontWeight:700,boxShadow:'0 4px 20px rgba(11,61,145,.35)',opacity:loading?.7:1}}>
                  {loading ? 'Connexion...' : 'Connexion securisee'}
                </button>
              </form>

              <div style={{textAlign:'center',marginTop:20,color:'#94A3B8',fontSize:12}}>
                Acces securise — Donnees chiffrees
              </div>
            </>
          ) : (
            <>
              <button onClick={()=>{setResetMode(false);setError('')}}
                style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'#64748B',fontSize:13,fontWeight:600,marginBottom:24,padding:0}}>
                ← Retour a la connexion
              </button>

              <div style={{fontSize:28,fontWeight:800,color:'#1E293B',letterSpacing:'-.5px'}}>Mot de passe oublie 🔑</div>
              <div style={{color:'#475569',fontSize:14,marginTop:6,marginBottom:32}}>
                Entrez votre email — nous vous enverrons un lien pour creer un nouveau mot de passe.
              </div>

              {error && (
                <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#DC2626',fontWeight:500}}>
                  {error}
                </div>
              )}

              <form onSubmit={handleResetRequest}>
                <div style={{marginBottom:24}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Adresse email de votre compte</label>
                  <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'2px solid #E2E8F0',fontFamily:'inherit',fontSize:14,outline:'none',boxSizing:'border-box'}}
                    onFocus={e=>e.target.style.borderColor='#0B3D91'}
                    onBlur={e=>e.target.style.borderColor='#E2E8F0'}
                    placeholder="votre@email.com" required autoComplete="email" />
                </div>
                <button type="submit" disabled={resetLoading}
                  style={{width:'100%',padding:14,borderRadius:12,border:'none',cursor:resetLoading?'not-allowed':'pointer',background:'linear-gradient(135deg,#0B3D91,#1452B5)',color:'#fff',fontFamily:'inherit',fontSize:15,fontWeight:700,boxShadow:'0 4px 20px rgba(11,61,145,.35)',opacity:resetLoading?.7:1}}>
                  {resetLoading ? 'Envoi...' : 'Envoyer le lien de reinitialisation'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
