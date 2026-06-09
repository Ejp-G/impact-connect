export const ini = (fn, ln) => ((fn||'')[0]||'') + ((ln||'')[0]||'')
export const H = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
export const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null
export const scoreColor = (sc) => sc >= 70 ? '#22C55E' : sc >= 40 ? '#F97316' : '#EF4444'

export async function logAudit(supabase, action, entityType, entityId, details = {}) {
  await supabase.from('audit_log').insert({
    action, entity_type: entityType, entity_id: entityId, details
  })
}
