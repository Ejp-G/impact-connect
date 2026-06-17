'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NAV_ITEMS, ROLE_NAV, ROLES } from '@/lib/constants'
import PasswordInput from '@/components/ui/PasswordInput'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const ini = (nm) => nm?.split(' ').map(w=>w[0]).slice(0,2).join('') || 'U'

export default function Sidebar({ profile, activeId, collapsed, setCollapsed, mobileOpen, isMobile }) {
  const router = useRouter()
  const supabase = createClient()
  const [showProfile, setShowProfile] = useState(false)
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const { subscribed, loading: pushLoading, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()

  const access = ROLE_NAV[profile?.role]
  const visibleNav = NAV_ITEMS.filter(it => {
    if (it.id === 'utilisateurs' && profile?.role !== 'admin') return false
    if (access === 'all') return true
    return access?.includes(it.id)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwError(''); setPwSuccess(false)
    if (!pwForm.newPw || pwForm.newPw.length < 8) {
      setPwError('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('Les mots de passe ne correspondent pas.')
      return
    }
    setSaving(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email, password: pwForm.current
    })
    if (signInError) {
      setPwError('Mot de passe actuel incorrect.')
      setSaving(false); return
    }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { setPwError(error.message); setSaving(false); return }
    setPwSuccess(true); setSaving(false)
    setPwForm({ current:'', newPw:'', confirm:'' })
    setTimeout(() => setPwSuccess(false), 4000)
  }

  async function handleForgotFromModal() {
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: window.location.origin + '/reset-password'
    })
    if (!error) { setPwSuccess(true); setPwError('') }
    else setPwError(error.message)
  }

  return (
    <>
      <div className={`sb${!isMobile && collapsed?' col':''} ${isMobile && mobileOpen?' mobile-open':''}`}>
        <div className="sbh">
          <div className="sbh-ic">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="7.5" y="1" width="3" height="16" rx="1.5" fill="white"/>
              <rect x="1" y="6" width="16" height="3" rx="1.5" fill="white"/>
            </svg>
          </div>
          {!collapsed && <div><div className="sb-nm">IMPACT</div><div className="sb-sm">CONNECT</div></div>}
        </div>

        {!isMobile && (
          <button className="sbt" onClick={()=>setCollapsed(!collapsed)}>
            {collapsed ? '›' : '‹'}
          </button>
        )}

        <nav className="sbn">
          {visibleNav.map(item => (
            <Link key={item.id} href={item.href}
              className={`si${activeId===item.id?' on':''}`}
              title={collapsed ? item.label : ''}>
              <span className="si-ic">{item.icon}</span>
              {!collapsed && <span className="si-lb">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div style={{borderTop:'1px solid rgba(255,255,255,.08)'}}>
          <div className="sbf" onClick={()=>setShowProfile(true)} title="Mon profil" style={{cursor:'pointer'}}>
            <div className="sbu-av">{ini(profile?.name)}</div>
            {!collapsed && (
              <div style={{flex:1}}>
                <div className="sbu-n">{profile?.name || 'Utilisateur'}</div>
                <div className="sbu-r">{ROLES[profile?.role] || profile?.role}</div>
              </div>
            )}
            {!collapsed && <span style={{color:'rgba(255,255,255,.4)',fontSize:13}}>⚙️</span>}
          </div>

          <div onClick={handleLogout}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',cursor:'pointer',opacity:.6,transition:'opacity .2s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1}
            onMouseLeave={e=>e.currentTarget.style.opacity=.6}
            title="Se deconnecter">
            <span style={{fontSize:16}}>⏻</span>
            {!collapsed && <span style={{color:'rgba(255,255,255,.7)',fontSize:12,fontWeight:500}}>Deconnexion</span>}
          </div>
        </div>
      </div>

      {showProfile && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
          onClick={e=>e.target===e.currentTarget&&setShowProfile(false)}>
          <div style={{background:'#fff',borderRadius:20,padding:32,width:'100%',maxWidth:420,maxHeight:'90vh',overflowY:'auto'}}>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700}}>Mon profil</div>
              <button onClick={()=>setShowProfile(false)}
                style={{width:32,height:32,borderRadius:8,background:'#F1F5F9',border:'none',cursor:'pointer',fontSize:16,color:'#64748B'}}>
                x
              </button>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'#F8FAFC',borderRadius:14,marginBottom:16}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'var(--n)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20,fontWeight:700,flexShrink:0}}>
                {ini(profile?.name)}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:16,fontWeight:700,color:'#1E293B'}}>{profile?.name}</div>
                <div style={{fontSize:13,color:'#64748B',marginTop:2,overflow:'hidden',textOverflow:'ellipsis'}}>{profile?.email}</div>
                <div style={{marginTop:6}}>
                  <span style={{fontSize:11,background:'rgba(11,61,145,.1)',color:'var(--n)',padding:'2px 10px',borderRadius:999,fontWeight:600}}>
                    {ROLES[profile?.role] || profile?.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Bouton se deconnecter directement depuis le profil */}
            <button onClick={handleLogout} style={{
              width:'100%', padding:'11px 0', borderRadius:10, border:'1px solid #FEE2E2',
              background:'#FEF2F2', color:'#DC2626', fontFamily:'inherit', fontSize:13,
              fontWeight:700, cursor:'pointer', marginBottom:20, display:'flex',
              alignItems:'center', justifyContent:'center', gap:8
            }}>
              ⏻ Se deconnecter
            </button>

            {/* Parametres personnels — Notifications */}
            <div style={{fontSize:13,fontWeight:700,color:'#1E293B',marginBottom:10,textTransform:'uppercase',letterSpacing:.4,fontSize:11}}>
              Parametres personnels
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#F8FAFC',borderRadius:12,marginBottom:20}}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>Notifications push</div>
                <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>
                  {pushPermission === 'denied'
                    ? 'Bloquees dans les reglages du navigateur'
                    : subscribed ? 'Activees sur cet appareil' : 'Desactivees sur cet appareil'}
                </div>
              </div>
              {pushPermission !== 'denied' && (
                <div onClick={()=>pushLoading?null:(subscribed?pushUnsubscribe():pushSubscribe())}
                  className={`tog ${subscribed?'on':'off'}`} style={{cursor:pushLoading?'wait':'pointer',opacity:pushLoading?.6:1}}>
                  <div className="tog-th" />
                </div>
              )}
            </div>

            {/* Changer mot de passe */}
            <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:'#1E293B'}}>
              Changer mon mot de passe
            </div>

            <form onSubmit={changePassword}>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                  Mot de passe actuel *
                </label>
                <PasswordInput value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} placeholder="Votre mot de passe actuel" required />
              </div>

              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                  Nouveau mot de passe * (min. 8 caracteres)
                </label>
                <PasswordInput value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} placeholder="Nouveau mot de passe" required minLength={8} />
              </div>

              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
                  Confirmer le nouveau mot de passe *
                </label>
                <PasswordInput value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} placeholder="Confirmer le mot de passe" required />
              </div>

              <div style={{textAlign:'center',marginBottom:14}}>
                <span onClick={handleForgotFromModal}
                  style={{fontSize:12,color:'#0B3D91',cursor:'pointer',fontWeight:600,textDecoration:'underline'}}>
                  J&apos;ai oublie mon mot de passe — recevoir un lien par email
                </span>
              </div>

              {pwError && (
                <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#DC2626',fontWeight:500}}>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#16A34A',fontWeight:500}}>
                  Operation reussie !
                </div>
              )}

              <div style={{display:'flex',gap:10}}>
                <button type="button" onClick={()=>setShowProfile(false)}
                  style={{flex:1,padding:11,borderRadius:10,border:'none',cursor:'pointer',background:'#F1F5F9',color:'#64748B',fontFamily:'inherit',fontSize:13,fontWeight:600}}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  style={{flex:2,padding:11,borderRadius:10,border:'none',cursor:saving?'not-allowed':'pointer',background:'var(--n)',color:'#fff',fontFamily:'inherit',fontSize:13,fontWeight:700,opacity:saving?.7:1}}>
                  {saving ? 'Modification...' : 'Changer le mot de passe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
