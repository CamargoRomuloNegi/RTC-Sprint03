/**
 * @file AiResponsePanel.tsx
 * @description Exibe a pergunta e a resposta da IA com Markdown renderizado.
 */
'use client'

import ReactMarkdown  from 'react-markdown'
import { User, Bot, Loader2 } from 'lucide-react'
import type { AiTurn } from '@/domain/models/AiTypes'

interface Props {
  turn:       AiTurn | null  // turno em exibição (pode ser o em progresso)
  isLoading:  boolean
  streamText: string         // texto chegando via stream
  error:      string | null
}

export function AiResponsePanel({ turn, isLoading, streamText, error }: Props) {
  if (!isLoading && !turn && !error) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease' }}>

      {/* Pergunta */}
      {(turn?.question || (isLoading && streamText === '' && !error)) && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={14} color="var(--color-primary)" />
          </div>
          <div style={{ flex: 1, background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-primary)', lineHeight: 1.5 }}>
              {turn?.question}
            </p>
          </div>
        </div>
      )}

      {/* Resposta */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bbf7d0' }}>
          {isLoading
            ? <Loader2 size={14} color="var(--color-valid)" style={{ animation: 'spin 1s linear infinite' }} />
            : <Bot size={14} color="var(--color-valid)" />
          }
        </div>
        <div style={{ flex: 1 }}>
          {/* Erro */}
          {error && (
            <div style={{ background: 'var(--color-debit-light)', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-debit-text)', lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {/* Loading sem texto ainda */}
          {isLoading && !streamText && !error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Analisando os dados…</span>
            </div>
          )}

          {/* Texto em streaming */}
          {(streamText || turn?.answer) && !error && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <div className="ai-markdown">
                <ReactMarkdown>
                  {isLoading ? streamText : (turn?.answer ?? '')}
                </ReactMarkdown>
              </div>
              {/* Tokens usados (apenas quando completo) */}
              {!isLoading && turn && turn.tokens > 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  {turn.tokens.toLocaleString()} tokens • {turn.model}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
