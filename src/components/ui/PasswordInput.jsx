'use client'
import { useState } from 'react'
export default function PasswordInput({
value, onChange, placeholder = 'Mot de passe',
required = false, minLength, autoComplete
}) {
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
width:'100%', padding:'12px 56px 12px 14px',
borderRadius:10, border:'2px solid #E2E8F0',
fontFamily:'inherit', fontSize:14, outline:'none',
boxSizing:'border-box', transition:'border-color .2s'
}}
onFocus={e => e.target.style.borderColor = '#0B3D91'}
onBlur={e => e.target.style.borderColor = '#E2E8F0'}
/>
<button
type="button"
onClick={() => setShow(!show)}
style={{
position:'absolute', right:12, top:'50%',
transform:'translateY(-50%)',
background:'none', border:'none', cursor:'pointer',
fontSize:11, fontWeight:700, color:'#64748B',
letterSpacing:.3, padding:'2px 4px',
textTransform:'uppercase', lineHeight:1
}}
>
{show ? 'Masquer' : 'Voir'}
</button>
</div>
)
}
