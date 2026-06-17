'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/ui/PasswordInput'
import PublicPageShell from '@/components/ui/PublicPageShell'

function ResetForm() {
  const [newPw, setNewPw]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.onAuthStateChange(() => {})
  }, [])

  async function handleReset(e) {
    e.preventDefault(); setError('')
    if (newPw.length < 8) { setError('Minimum 8 caracteres.'); return }
    if (newPw !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true); setSaving(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  if (success) return (
    <div className="auth-shell" style={{background:'linear-gradient(145deg,#072B6A,#0B3D91)'}}>
      <div className="auth-card" style={{textAlign:'center'}}>
        <div className="auth-emoji">✅</div>
        <div style={{fontSize:22,fontWeight:800,color:'#1E293B',marginBottom:8}}>Mot de passe modifie !</div>
        <div style={{fontSize:14,color:'#64748B'}}>Redirection vers la connexion...</div>
      </div>
    </div>
  )

  return (
    <div className="auth-shell" style={{background:'linear-gradient(145deg,#072B6A,#0B3D91)'}}>
      <div className="auth-card">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div className="auth-emoji">🔐</div>
          <div className="auth-title">Nouveau mot de passe</div>
          <div style={{fontSize:13,color:'#64748B',marginTop:6}}>Choisissez un mot de passe securise</div>
        </div>
        <form onSubmit={handleReset}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Nouveau mot de passe *</label>
            <PasswordInput value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Minimum 8 caracteres" required minLength={8} />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Confirmer *</label>
            <PasswordInput value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirmer le mot de passe" required />
          </div>
          {error && (
            <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#DC2626',fontWeight:500}}>
              {error}
            </div>
          )}
          <button type="submit" disabled={saving} className="auth-cta"
            style={{background:'linear-gradient(135deg,#0B3D91,#1452B5)',opacity:saving?.7:1}}>
            {saving ? 'Modification...' : 'Confirmer le nouveau mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <PublicPageShell>
      <Suspense fallback={<div>Chargement...</div>}><ResetForm /></Suspense>
    </PublicPageShell>
  )
}
