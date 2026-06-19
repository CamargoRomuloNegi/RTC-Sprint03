/**
 * @file AiHistoryPanel.tsx
 * @description Histórico dos últimos turnos da sessão de IA.
 */
'use client'

import { useState }    from 'react'
import ReactMarkdown   from 'react-markdown'
import { Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import type { AiTurn } from '@/domain/models/AiTypes'

interface Props {
  history:      AiTurn[]
  onClear:      () => void
}

export function AiHistoryPanel({ history, onClear }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (history.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={13} style={{ color: 'var(--color-text-muted)' }} />
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Histórico da Sessão ({history.length}/5)
          </p>
        </div>
        <button
          onClick={onClear}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
        >
          <Trash2 size={11} /> Limpar
        </button>
      </div>

      {/* Turnos */}
      {history.map(turn => (
        <div
          key={turn.id}
          style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setExpandedId(expandedId === turn.id ? null : turn.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '10px 14px',
              background: 'none', border: 'none', cursor: 'pointer', gap: '10px',
            }}
          >
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', textAlign: 'left', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {turn.question}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-data)' }}>
                {turn.tokens}t
              </span>
              {expandedId === turn.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </button>

          {expandedId === turn.id && (
            <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px' }}>
              <div className="ai-markdown" style={{ fontSize: '0.82rem' }}>
                <ReactMarkdown>{turn.answer}</ReactMarkdown>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                {new Date(turn.timestamp).toLocaleString('pt-BR')} • {turn.model}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
