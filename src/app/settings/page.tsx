/**
 * @file settings/page.tsx  (rota "/settings")
 * @description Configurações do Módulo de IA — modelo, limites e status.
 */
'use client'

import { useEffect, useState }  from 'react'
import { Bot, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useAiStore }            from '@/application/store/useAiStore'
import { GEMINI_MODELS }         from '@/domain/models/AiTypes'
import type { GeminiModel }      from '@/domain/models/AiTypes'
import { Card }                  from '@/components/ui/Card'

const TOKEN_OPTIONS = [512, 1024, 2048, 4096] as const

export default function SettingsPage() {
  const { model, maxTokens, setModel, setMaxTokens } = useAiStore()
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [checkingApi,   setCheckingApi]   = useState(true)

  // Reidratar o store (skipHydration: true requer este passo)
  useEffect(() => {
    useAiStore.persist.rehydrate()
  }, [])

  // Verificar status da chave no servidor
  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('/api/ai/status')
        const data = await res.json() as { configured: boolean }
        setApiConfigured(data.configured)
      } catch {
        setApiConfigured(false)
      } finally {
        setCheckingApi(false)
      }
    }
    check()
  }, [])

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Título */}
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Configurações
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Parâmetros operacionais do Módulo de IA
        </p>
      </div>

      {/* Status da API */}
      <Card title="Status do Sistema">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {checkingApi ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-border)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Verificando configuração…</span>
            </div>
          ) : apiConfigured ? (
            <>
              <CheckCircle size={20} color="var(--color-valid)" />
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-valid)' }}>
                  Chave Gemini configurada
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  GEMINI_API_KEY detectada nas variáveis de ambiente do servidor
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle size={20} color="var(--color-error)" />
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-error)' }}>
                  Chave Gemini não configurada
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  O operador deve adicionar <code style={{ fontFamily: 'var(--font-data)', background: 'var(--color-bg)', padding: '1px 4px', borderRadius: '3px' }}>GEMINI_API_KEY</code> nas variáveis de ambiente do Vercel.
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Obtenha uma chave gratuita em:{' '}
                  <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                    aistudio.google.com
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Seleção de Modelo */}
      <Card title="Modelo de IA" subtitle="Selecione o modelo Gemini a ser utilizado">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(Object.values(GEMINI_MODELS) as typeof GEMINI_MODELS[GeminiModel][]).map(m => (
            <label
              key={m.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${model === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: model === m.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={model === m.id}
                onChange={() => setModel(m.id)}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <Bot size={14} color={model === m.id ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: model === m.id ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                    {m.label}
                  </span>
                  {m.freeTier && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '10px' }}>
                      GRATUITO
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {m.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Limite de Tokens */}
      <Card title="Limite de Resposta" subtitle="Máximo de tokens de saída por consulta">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TOKEN_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setMaxTokens(t)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${maxTokens === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: maxTokens === t ? 'var(--color-primary)' : 'var(--color-surface)',
                color: maxTokens === t ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer', fontFamily: 'var(--font-data)',
                fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {t.toLocaleString()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '14px', padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
          <Info size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            <strong>1024 tokens</strong> (~750 palavras) é suficiente para análises fiscais detalhadas.
            Valores maiores consomem mais da cota gratuita por consulta.
          </p>
        </div>
      </Card>

      {/* Aviso de privacidade — permanente */}
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
      }}>
        <AlertTriangle size={18} style={{ color: 'var(--color-warn)', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
            Aviso de Privacidade — Módulo de IA
          </p>
          <p style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.6 }}>
            Ao usar o módulo de IA, um <strong>sumário estatístico</strong> da sua apuração é enviado ao Google Gemini para processamento.
            No plano gratuito (Free Tier), o Google pode usar esses dados para melhorar seus modelos.
          </p>
          <p style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.6, marginTop: '6px' }}>
            <strong>O que é enviado:</strong> totais agregados, percentuais, distribuição por tipo e CFOPs.<br />
            <strong>O que NÃO é enviado:</strong> CNPJs, nomes de empresas, chaves de acesso ou qualquer dado individual.
          </p>
          <p style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '8px' }}>
            Para uso com dados confidenciais, utilize uma chave do plano pago no{' '}
            <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
              style={{ color: '#b45309', fontWeight: 600 }}>
              Google AI Studio
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
