'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_LIMIT = 15 * 60 * 1000  // 15 minutes
const WARNING_BEFORE   = 1  * 60 * 1000  // 1 minute avant

export function useSessionGuard() {
  const router        = useRouter()
  const timerRef      = useRef(null)
  const warningRef    = useRef(null)
  const warningElRef  = useRef(null)
  const supabase      = createClient()

  const removeWarning = useCallback(() => {
    if (warningElRef.current) {
      warningElRef.current.remove()
      warningElRef.current = null
    }
  }, [])

  const logout = useCallback(async () => {
    removeWarning()
    await supabase.auth.signOut()
    sessionStorage.clear()
    router.push('/login')
  }, [supabase, router, removeWarning])

  const showWarning = useCallback(() => {
    removeWarning()
    const el = document.createElement('div')
    el.id = 'session-warning'
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#0B3D91;color:#fff;padding:14px 24px;border-radius:12px;
      font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3);
      display:flex;align-items:center;gap:12px;white-space:nowrap;
    `
    el.innerHTML = `
      <span>⚠️ Session expire dans 1 minute</span>
      <button id="session-keep" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13px;">
        Rester connecté
      </button>
    `
    document.body.appendChild(el)
    warningElRef.current = el
    document.getElementById('session-keep')?.addEventListener('click', resetTimer)
  }, [removeWarning])

  const resetTimer = useCallback(() => {
    removeWarning()
    clearTimeout(timerRef.current)
    clearTimeout(warningRef.current)
    warningRef.current = setTimeout(showWarning, INACTIVITY_LIMIT - WARNING_BEFORE)
    timerRef.current   = setTimeout(logout, INACTIVITY_LIMIT)
  }, [logout, showWarning, removeWarning])

  useEffect(() => {
    // Déconnexion à la fermeture de l'onglet
    const handleUnload = () => {
      sessionStorage.setItem('tab_closed', '1')
    }
    window.addEventListener('beforeunload', handleUnload)

    // Si l'onglet a été fermé puis rouvert
    if (sessionStorage.getItem('tab_closed')) {
      sessionStorage.clear()
      supabase.auth.signOut().then(() => router.push('/login'))
      return
    }

    // Événements d'activité
    const events = ['mousemove','keydown','click','touchstart','scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))

    // Démarrer le timer
    resetTimer()

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
      clearTimeout(warningRef.current)
      removeWarning()
    }
  }, [resetTimer, removeWarning, supabase, router])
}
