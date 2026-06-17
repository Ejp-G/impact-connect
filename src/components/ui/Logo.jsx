'use client'
import { useBranding } from '@/components/ui/BrandingProvider'

const ICONS = {
  cross: (
    <>
      <rect x="9.5" y="2" width="5" height="20" rx="2" fill="#fff"/>
      <rect x="2" y="9.5" width="20" height="5" rx="2" fill="#fff"/>
    </>
  ),
  star: (
    <polygon points="12,2 14.9,8.7 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.7" fill="#fff" />
  ),
  flame: (
    <path d="M12 2C9 7 6 9.5 6 13.5a6 6 0 0012 0C18 9.5 15 7 12 2z" fill="#fff" />
  ),
  dove: (
    <path d="M2 16.5C6 11 9.5 8.5 12 8.5s6 2.5 10 8c-4-1.8-7-2.7-10-2.7s-6 .9-10 2.7z" fill="#fff" />
  ),
  crown: (
    <>
      <path d="M3 17l1.3-8L9 13.3 12 6l3 7.3 4.7-4.3L21 17H3z" fill="#fff" />
      <rect x="3" y="18.2" width="18" height="2.3" rx="1" fill="#fff" />
    </>
  ),
}

const SIZES = { small:32, normal:44, large:64 }

export default function Logo({ size = 'normal', mono = false }) {
  const branding = useBranding()
  const px = SIZES[size] || SIZES.normal

  if (branding.customLogoUrl) {
    return (
      <img
        src={branding.customLogoUrl}
        alt={`${branding.name1} ${branding.name2}`}
        style={{ width:px, height:px, objectFit:'contain', borderRadius:px*0.28, flexShrink:0 }}
      />
    )
  }

  return (
    <div style={{
      width:px, height:px, borderRadius:px*0.28, flexShrink:0,
      background: mono ? 'rgba(255,255,255,.18)' : 'var(--brand-surface)',
      display:'flex', alignItems:'center', justifyContent:'center'
    }}>
      <svg width={px*0.52} height={px*0.52} viewBox="0 0 24 24" fill="none">
        {ICONS[branding.icon] || ICONS.cross}
      </svg>
    </div>
  )
}
