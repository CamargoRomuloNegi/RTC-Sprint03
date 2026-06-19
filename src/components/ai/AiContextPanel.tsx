/**
 * @file AiContextPanel.tsx
 * @description Painel de transparência — mostra exatamente o que será enviado ao Gemini.
 * Permite ao usuário verificar e ter confiança no que é transmitido.
 */
'use client'

import { useState }   from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import type { AiContext } from '@/domain/models/AiTypes'
import { formatBRL }      from '@/lib/utils'

interface Props { context: AiContext }

export function AiContextPanel({ context: ctx }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={15} style={{ color: 'var(--color-valid)' }} />
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dados que serão enviados ao Gemini
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}
        >
          {expanded ? <EyeOff size={13} /> : <Eye size={13} />}
          {expanded ? 'Ocultar' : 'Ver detalhes'}
        </button>
      </div>

      {/* Resumo sempre visível */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1px', background: 'var(--color-border)', borderTop: '1px solid var(--color-border)' }}>
        {[
          { label: 'Período',     value: ctx.period },
          { label: 'Documentos', value: ctx.totalDocs.toLocaleString('pt-BR') },
          { label: 'Entradas',   value: formatBRL(ctx.volumes.inbound) },
          { label: 'Saídas',     value: formatBRL(ctx.volumes.outbound) },
          { label: 'Crédito IBS/CBS', value: formatBRL(ctx.ibscbs.credito), green: true },
          { label: 'Débito IBS/CBS',  value: formatBRL(ctx.ibscbs.debito),  red: true },
        ].map(({ label, value, green, red }) => (
          <div key={label} style={{ padding: '10px 14px', background: 'var(--color-surface)' }}>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '3px' }}>
              {label}
            </p>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.88rem', fontWeight: 600, color: green ? 'var(--color-credit-text)' : red ? 'var(--color-debit-text)' : 'var(--color-text-primary)' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Detalhe expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ctx.byDocType.length > 0 && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Por Tipo</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ctx.byDocType.map(t => (
                  <span key={t.tipo} style={{ fontSize: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '4px' }}>
                    {t.tipo}: {t.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ctx.topCfops.length > 0 && (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Top CFOPs por IBS/CBS</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ctx.topCfops.slice(0, 5).map(c => (
                  <span key={c.cfop} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-data)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '4px' }}>
                    {c.cfop}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p style={{ fontSize: '0.72rem', color: 'var(--color-valid)', fontWeight: 600 }}>
            ✓ Nenhum CNPJ, nome de empresa ou chave de acesso é enviado
          </p>
        </div>
      )}
    </div>
  )
}
