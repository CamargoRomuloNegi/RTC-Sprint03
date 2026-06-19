/**
 * @file Sidebar.tsx
 * @description Navegação lateral fixa.
 * Rotas: Upload, Documentos, Apuração RTC, Conformidade, Temporal.
 */
'use client'

import Link         from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Upload, FileSearch, BarChart2,
  AlertTriangle, FileText, Clock,
} from 'lucide-react'
import { useFiscalStore } from '@/application/store/useFiscalStore'

// ---------------------------------------------------------------------------
// NAVEGAÇÃO — ordem definitiva
// ---------------------------------------------------------------------------
const NAV = [
  { href: '/',          label: 'Upload',        icon: Upload,        desc: 'Carregar XMLs'    },
  { href: '/explorer',  label: 'Documentos',    icon: FileSearch,    desc: 'Explorar lote'    },
  { href: '/analysis',  label: 'Apuração RTC',  icon: BarChart2,     desc: 'IBS/CBS'          },
  { href: '/temporal',  label: 'Temporal',       icon: Clock,         desc: 'Mensal/Trimestral' },
  { href: '/reports',   label: 'Conformidade',  icon: AlertTriangle, desc: 'Inconformidades'  },
]

export function Sidebar() {
  const pathname = usePathname()
  const docCount = useFiscalStore(s => s.documents.length)
  const cnpjRoot = useFiscalStore(s => s.analyzedCnpjRoot)

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column',
      background: '#0f1729', color: '#fff',
      flexShrink: 0, width: 'var(--sidebar-width)',
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: '#1d4ed8', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FileText size={16} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2 }}>Apuração RTC</p>
            <p style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.2 }}>Reforma Tributária</p>
          </div>
        </div>

        {/* CNPJ analisado */}
        {cnpjRoot && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(29,78,216,0.15)',
            border: '1px solid rgba(29,78,216,0.3)',
            borderRadius: '6px', padding: '6px 10px',
          }}>
            <p style={{ fontSize: '0.68rem', color: '#93c5fd', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Empresa analisada
            </p>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: '#bfdbfe' }}>
              CNPJ Raiz: {cnpjRoot}
            </p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: '10px' }}>
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '8px', marginBottom: '2px',
                background: active ? 'rgba(29,78,216,0.25)' : 'transparent',
                border: `1px solid ${active ? 'rgba(29,78,216,0.4)' : 'transparent'}`,
                cursor: 'pointer',
              }}>
                <Icon size={17} color={active ? '#93c5fd' : '#475569'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 500, color: active ? '#e0f2fe' : '#94a3b8', lineHeight: 1.2 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: active ? '#7dd3fc' : '#374151', lineHeight: 1.2 }}>
                    {desc}
                  </p>
                </div>
                {href !== '/' && docCount > 0 && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    background: active ? '#1d4ed8' : 'rgba(255,255,255,0.08)',
                    color: active ? '#fff' : '#64748b',
                    borderRadius: '10px', padding: '1px 6px', flexShrink: 0,
                  }}>
                    {docCount}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Rodapé */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: '0.7rem', color: '#334155', lineHeight: 1.6 }}>
          🔒 Processamento local<br />
          Dados nunca saem do seu dispositivo.
        </p>
        <p style={{ fontSize: '0.65rem', color: '#1e293b', marginTop: '4px' }}>v0.3.0 — Sprint 3</p>
      </div>
    </aside>
  )
}
