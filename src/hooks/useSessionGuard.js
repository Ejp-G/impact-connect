'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_LIMIT = 15 * 60 * 1000
const WARNING_BEFORE   = 1  * 60 * 1000

export function useSessionGuard() {
  const routerRef    = useRef(null)
  const timerRef     = useRef(null)
  const warningRef   = useRef(null)
  const warningElRef = useRef(null)
  const supabaseRef  = useRef(null)
  const router = useRouter()

  useEffect(() => {
    routerRef.current  = router
    supabaseRef.current = createClient()
  }, [router])

  const removeWarning = useCallback(() => {
    if (warningElRef.current) {
      warningElRef.current.remove()
      warningElRef.current = null
    }
  }, [])

  const logout = useCallback(async () => {
    removeWarning()
    clearTimeout(timerRef.current)
    clearTimeout(warningRef.current)
    await supabaseRef.current?.auth.signOut()
    routerRef.current?.push('/login')
  }, [removeWarning])

  const resetTimer = useCallback(() => {
    removeWarning()
    clearTimeout(timerRef.current)
    clearTimeout(warningRef.current)
    warningRef.current = setTimeout(() => {
      const el = document.createElement('div')
      el.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:#0B3D91;color:#fff;padding:14px 24px;border-radius:12px;
        font-size:14px;font-weight:600;z-index:9999;
        box-shadow:0 4px 20px rgba(0,0,0,.3);
        display:flex;align-items:center;gap:12px;white-space:nowrap;
      `
      el.innerHTML = `
        <span>⚠️ Session expire dans 1 minute</span>
        <button style="background:rgba(255,255,255,.2);border:none;color:#fff;
          padding:6px 14px;border-radius:8px;cursor:pointer;
          font-weight:700;font-family:inherit;font-size:13px;">
          Rester connecté
        </button>
      `
      document.body.appendChild(el)
      warningElRef.current = el
      el.querySelector('button')?.addEventListener('click', () => resetTimer())
    }, INACTIVITY_LIMIT - WARNING_BEFORE)

    timerRef.current = setTimeout(logout, INACTIVITY_LIMIT)
  }, [logout, removeWarning])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
      clearTimeout(warningRef.current)
      removeWarning()
    }
  }, [resetTimer, removeWarning])
}
