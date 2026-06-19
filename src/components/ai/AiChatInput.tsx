/**
 * @file AiChatInput.tsx
 * @description Campo de pergunta livre + perguntas sugeridas por categoria.
 */
'use client'

import { useState, useRef } from 'react'
import { Send, Loader2 }    from 'lucide-react'

interface Props {
  onSubmit:  (question: string) => void
  isLoading: boolean
  disabled:  boolean
}

// Perguntas sugeridas organizadas por categoria
const SUGGESTED = [
  {
    category: 'Análise de Posição',
    questions: [
      'Analise minha posição credora/devedora e explique o que significa na prática',
      'Por que meus débitos superam meus créditos? O que posso fazer para equilibrar?',
    ],
  },
  {
    category: 'Conformidade',
    questions: [
      'Tenho fornecedores RPA sem IBS/CBS. Qual o impacto e como devo agir?',
      'Como a composição entre fornecedores RPA e Simples Nacional afeta minha posição?',
    ],
  },
  {
    category: 'Operacional',
    questions: [
      'Quais CFOPs concentram maior carga de IBS/CBS nas minhas saídas?',
      'Como calcular o peso do IBS/CBS para vendas a clientes do Simples Nacional?',
    ],
  },
  {
    category: 'Estratégico',
    questions: [
      'Com base neste perfil, quais são os principais pontos de atenção para a transição da Reforma Tributária?',
    ],
  },
]

export function AiChatInput({ onSubmit, isLoading, disabled }: Props) {
  const [text, setText]   = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const q = text.trim()
    if (!q || isLoading || disabled) return
    onSubmit(q)
    setText('')
  }

  const handleSuggestion = (question: string) => {
    setShowSuggestions(false)
    onSubmit(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Perguntas sugeridas */}
      {showSuggestions && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Perguntas sugeridas
          </p>
          {SUGGESTED.map(group => (
            <div key={group.category}>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '5px', fontStyle: 'italic' }}>
                {group.category}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {group.questions.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    disabled={disabled}
                    style={{
                      textAlign: 'left', padding: '8px 12px',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '0.82rem', color: 'var(--color-text-secondary)',
                      lineHeight: 1.4, transition: 'all 0.15s',
                      opacity: disabled ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!disabled) (e.currentTarget).style.borderColor = 'var(--color-primary)' }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = 'var(--color-border)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowSuggestions(false)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)', textDecoration: 'underline' }}
          >
            Ocultar sugestões
          </button>
        </div>
      )}

      {/* Campo livre */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {!showSuggestions && (
          <button
            onClick={() => setShowSuggestions(true)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-primary)', marginBottom: '2px' }}
          >
            ← Ver perguntas sugeridas
          </button>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder="Faça uma pergunta sobre sua apuração de IBS/CBS… (Ctrl+Enter para enviar)"
              disabled={disabled || isLoading}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-primary)', background: 'var(--color-surface)',
                resize: 'vertical', lineHeight: 1.5,
                opacity: (disabled || isLoading) ? 0.6 : 1,
              }}
            />
            <span style={{ position: 'absolute', bottom: '6px', right: '10px', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              {text.length}/500
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isLoading || disabled}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '42px', height: '42px', borderRadius: 'var(--radius-md)',
              background: (!text.trim() || isLoading || disabled) ? 'var(--color-border)' : 'var(--color-primary)',
              border: 'none', cursor: (!text.trim() || isLoading || disabled) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {isLoading
              ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={16} color="#fff" />
            }
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          Cada consulta é independente — a IA não retém contexto entre perguntas.
        </p>
      </div>
    </div>
  )
}
