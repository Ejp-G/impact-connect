'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CH_COLORS = { whatsapp:'#25D366', sms:'#0B3D91', email:'#F97316' }
const CH_ICONS = { whatsapp:'💬', sms:'📱', email:'📧' }

export default function CommunicationsClient({ templates, logs, contacts }) {
  const [tab, setTab] = useState('compose')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedContact, setSelectedContact] = useState('')
  const [channel, setChannel] = useState('whatsapp')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const router = useRouter()

  function applyTemplate(tpl) {
    setSelectedTemplate(tpl)
    setMessage(tpl.content)
    setChannel(tpl.channel)
  }

  async function sendMessage() {
    if (!selectedContact || !message) return alert('Sélectionnez un contact et rédigez le message.')
    setSending(true)
    await fetch('/api/communications', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contactId:selectedContact, channel, content:message, templateId:selectedTemplate?.id }) })
    setSending(false)
    setMessage('')
    setSelectedContact('')
    router.refresh()
  }

  return (
    <div style={{maxWidth:1100}}>
      <div style={{display:'flex',gap:8,marginBottom:24}}>
        {[['compose','✍️ Composer'],['logs','📋 Historique'],['templates','📝 Modèles']].map(([t,l])=>(
          <div key={t} onClick={()=>setTab(t)} style={{padding:'8px 18px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600,background:tab===t?'var(--n)':'#F1F5F9',color:tab===t?'#fff':'var(--gd)'}}>
            {l}
          </div>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="g2r">
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="card">
              <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>✍️ Nouveau message</div>
              <div className="form-group"><label className="form-label">Contact destinataire</label>
                <select className="form-input" value={selectedContact} onChange={e=>setSelectedContact(e.target.value)}>
                  <option value="">Sélectionner un contact…</option>
                  {contacts.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Canal</label>
                <div style={{display:'flex',gap:8}}>
                  {[['whatsapp','💬 WhatsApp'],['sms','📱 SMS'],['email','📧 Email']].map(([v,l])=>(
                    <div key={v} onClick={()=>setChannel(v)} style={{flex:1,padding:10,borderRadius:10,border:`2px solid ${channel===v?CH_COLORS[v]:'var(--br)'}`,background:channel===v?`${CH_COLORS[v]}15`:'#fff',textAlign:'center',fontSize:12,fontWeight:600,color:channel===v?CH_COLORS[v]:'#64748B',cursor:'pointer'}}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Message</label>
                <textarea className="form-input" value={message} onChange={e=>setMessage(e.target.value)} rows={6} placeholder="Rédigez votre message…" style={{resize:'vertical'}} />
                <div style={{fontSize:11,color:'var(--gy)',marginTop:4,textAlign:'right'}}>{message.length} caractères</div>
              </div>
              <button onClick={sendMessage} disabled={sending} className="btn btn-primary" style={{width:'100%'}}>
                {sending?'⏳ Envoi…':`${CH_ICONS[channel]} Envoyer via ${channel}`}
              </button>
            </div>
          </div>

          <div className="card" style={{height:'fit-content'}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>📝 Modèles rapides</div>
            {templates.map(t=>(
              <div key={t.id} onClick={()=>applyTemplate(t)} style={{padding:'12px',borderRadius:10,border:`1px solid ${selectedTemplate?.id===t.id?CH_COLORS[t.channel]:'var(--br)'}`,background:selectedTemplate?.id===t.id?`${CH_COLORS[t.channel]}10`:'#F8FAFC',cursor:'pointer',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700}}>{t.name}</span>
                  <span style={{fontSize:10,background:CH_COLORS[t.channel]+'20',color:CH_COLORS[t.channel],padding:'2px 6px',borderRadius:999,fontWeight:600}}>{CH_ICONS[t.channel]} {t.channel}</span>
                </div>
                <div style={{fontSize:11,color:'var(--gy)',lineHeight:1.4}}>{t.content.slice(0,80)}…</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <table>
            <thead><tr><th>Destinataire</th><th>Canal</th><th>Message</th><th>Date</th><th>Statut</th></tr></thead>
            <tbody>
              {logs.map(l=>(
                <tr key={l.id}>
                  <td style={{fontWeight:600,fontSize:13}}>{l.contact?.first_name} {l.contact?.last_name}</td>
                  <td><span style={{fontSize:11,background:CH_COLORS[l.channel]+'20',color:CH_COLORS[l.channel],padding:'2px 8px',borderRadius:999,fontWeight:600}}>{CH_ICONS[l.channel]} {l.channel}</span></td>
                  <td style={{fontSize:12,color:'var(--gd)',maxWidth:300}}>{l.content?.slice(0,60)}…</td>
                  <td style={{fontSize:12,color:'var(--gy)'}}>{new Date(l.sent_at).toLocaleDateString('fr-FR')}</td>
                  <td><span style={{fontSize:11,background:l.status==='sent'?'#EFF6FF':'#F0FDF4',color:l.status==='sent'?'#3B82F6':'#22C55E',padding:'2px 8px',borderRadius:999,fontWeight:600}}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'templates' && (
        <div className="g3">
          {templates.map(t=>(
            <div key={t.id} className="card" style={{borderTop:`3px solid ${CH_COLORS[t.channel]}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:14,fontWeight:700}}>{t.name}</div>
                <span style={{fontSize:11,background:CH_COLORS[t.channel]+'20',color:CH_COLORS[t.channel],padding:'2px 8px',borderRadius:999,fontWeight:600}}>{CH_ICONS[t.channel]} {t.channel}</span>
              </div>
              <div style={{fontSize:12,color:'var(--gd)',lineHeight:1.6,background:'#F8FAFC',padding:12,borderRadius:8}}>{t.content}</div>
              {t.variables?.length > 0 && (
                <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:4}}>
                  {t.variables.map(v=><span key={v} style={{fontSize:10,background:'#EFF6FF',color:'#3B82F6',padding:'2px 6px',borderRadius:4,fontWeight:600}}>{v}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
