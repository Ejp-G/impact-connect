'use client'
import { useState } from 'react'

export default function PasswordInput({ value, onChange, placeholder = 'Mot de passe', required = false, minLength, autoComplete }) {
  const [show, setShow] = useState(false)

  return (
    <div style={{ position:'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{
          width:'100%', padding:'12px 44px 12px 14px',
          borderRadius:10, border:'2px solid #E2E8F0',
          fontFamily:'inherit', fontSize:14, outline:'none',
          boxSizing:'border-box', transition:'border-color .2s'
        }}
        onFocus={e => e.target.style.borderColor = '#0B3D91'}
        onBlur={e  => e.target.style.borderColor = '#E2E8F0'}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
          background:'none', border:'none', cursor:'pointer',
          fontSize:18, lineHeight:1, padding:4, color:'#64748B',
          display:'flex', alignItems:'center', justifyContent:'center'
        }}
        title={show ? 'Masquer' : 'Afficher'}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
