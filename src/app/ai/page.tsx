/**
 * @file ai/page.tsx  (rota "/ai")
 * @description Gerador do Dossiê Tributário RTC com indicador de progresso e tratamento de erro.
 *
 * MELHORIAS Sprint 4 v3:
 *   - Indicador de progresso em tempo real com fases e tempo decorrido
 *   - Erros exibidos com mensagem específica e botão de retry
 *   - Sem teto artificial de tokens — dossiê sempre completo
 *   - Logo e nome da empresa no cabeçalho do relatório exportado
 */
/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Sparkles, AlertCircle, Settings, Clock, FileText, CheckCircle } from 'lucide-react'
import Link                   from 'next/link'
import { useFiscalStore }     from '@/application/store/useFiscalStore'
import { useAiStore }         from '@/application/store/useAiStore'
import { buildAiContext }     from '@/application/services/AiContextService'
import { AiContextPanel }     from '@/components/ai/AiContextPanel'
import { AiReport }           from '@/components/ai/AiReport'
import { EmptyState }         from '@/components/ui/EmptyState'
import type { AiContext }     from '@/domain/models/AiTypes'

// ---------------------------------------------------------------------------
// FASES DO PROGRESSO
// ---------------------------------------------------------------------------

const PHASES = [
  { icon: '📋', label: 'Preparando contexto fiscal…'        },
  { icon: '🤖', label: 'Conectando ao Gemini…'              },
  { icon: '✍️', label: 'Gerando Sumário Executivo…'          },
  { icon: '📊', label: 'Analisando posição RTC…'             },
  { icon: '🔍', label: 'Verificando conformidade…'           },
  { icon: '📁', label: 'Detalhando CFOPs e tipos…'           },
  { icon: '📈', label: 'Consolidando evolução temporal…'     },
  { icon: '💡', label: 'Formulando recomendações…'           },
  { icon: '✅', label: 'Finalizando o dossiê…'               },
]

// ---------------------------------------------------------------------------
// COMPONENTE DE PROGRESSO
// ---------------------------------------------------------------------------

function ProgressIndicator({ elapsed, charsReceived }: { elapsed: number; charsReceived: number }) {
  // Estimativa da fase com base no tempo decorrido (cada fase ~12s)
  const phaseIdx = Math.min(Math.floor(elapsed / 12), PHASES.length - 1)
  const phase    = PHASES[phaseIdx]!

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '16px',
      padding: '28px', background: 'var(--color-surface)',
      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
      alignItems: 'center', textAlign: 'center',
    }}>
      {/* Ícone animado */}
      <div style={{ fontSize: '2.2rem', animation: 'pulse 2s ease-in-out infinite' }}>
        {phase.icon}
      </div>

      {/* Fase atual */}
      <div>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          {phase.label}
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
          O dossiê completo pode levar 1 a 3 minutos — a IA está redigindo todas as 8 seções
        </p>
      </div>

      {/* Barra de progresso indeterminada */}
      <div style={{ width: '100%', maxWidth: '400px', height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%',
          background: 'var(--color-primary)',
          borderRadius: '2px',
          animation: 'progressSlide 1.8s ease-in-out infinite',
        }} />
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: '24px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {formatTime(elapsed)}
        </span>
        {charsReceived > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={12} /> ~{Math.ceil(charsReceived / 4).toLocaleString('pt-BR')} tokens recebidos
          </span>
        )}
      </div>

      {/* Indicador de fases */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {PHASES.map((p, i) => (
          <div key={i} style={{
            width: i === phaseIdx ? '20px' : '6px',
            height: '6px', borderRadius: '3px',
            background: i <= phaseIdx ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes progressSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL
// ---------------------------------------------------------------------------

export default function AiPage() {
  const documents = useFiscalStore(s => s.documents)
  const { model, companyLogo, companyName, setLoading, setError, isLoading, error } = useAiStore()

  const [streamText,    setStreamText]    = useState('')
  const [reportText,    setReportText]    = useState('')
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [aiContext,     setAiContext]      = useState<AiContext | null>(null)
  const [elapsed,       setElapsed]        = useState(0)
  const [charsReceived, setCharsReceived]  = useState(0)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Reidratar store (skipHydration)
  useEffect(() => {
    useAiStore.persist.rehydrate()
  }, [])

  // Verificar status da API
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then((d: { configured: boolean }) => setApiConfigured(d.configured))
      .catch(() => setApiConfigured(false))
  }, [])

  // Construir contexto
  useEffect(() => {
    setAiContext(documents.length > 0 ? buildAiContext(documents) : null)
  }, [documents])

  // Limpar timer ao desmontar
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ---------------------------------------------------------------------------
  // GERAR DOSSIÊ
  // ---------------------------------------------------------------------------

  const generateReport = useCallback(async () => {
    if (!aiContext || isLoading) return

    setLoading(true)
    setError(null)
    setStreamText('')
    setReportText('')
    setElapsed(0)
    setCharsReceived(0)

    // Iniciar timer de progresso
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    try {
      const response = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context: aiContext, model, maxTokens: 65536 }),
      })

      if (!response.ok) {
        let errMsg = `Erro ${response.status}`
        try {
          const errData = await response.json() as { error?: string }
          if (errData.error) errMsg = errData.error
        } catch { /* usar mensagem padrão */ }
        throw new Error(errMsg)
      }

      if (!response.body) throw new Error('Resposta vazia do servidor.')

      // Consumir stream
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamText(full)
        setCharsReceived(full.length)
      }

      if (!full.trim()) throw new Error('O Gemini retornou uma resposta vazia. Verifique a chave de API e tente novamente.')

      setReportText(full)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao gerar o dossiê.'
      setError(msg)
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setLoading(false)
      setStreamText('')
    }
  }, [aiContext, isLoading, model, setLoading, setError])

  // ---------------------------------------------------------------------------
  // ESTADOS DE GUARDA
  // ---------------------------------------------------------------------------

  if (documents.length === 0) {
    return <EmptyState variant="upload" title="Nenhum documento carregado" description="Carregue XMLs fiscais na tela de Upload para gerar o Dossiê Tributário." />
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Dossiê Tributário RTC
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Relatório completo gerado por IA — {documents.length.toLocaleString('pt-BR')} documentos analisados
          </p>
        </div>
        <Link href="/settings" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          <Settings size={13} /> Configurações
        </Link>
      </div>

      {/* Aviso: API não configurada */}
      {apiConfigured === false && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-warn)', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>Módulo de IA não configurado</p>
            <p style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.5 }}>
              Adicione <code style={{ fontFamily: 'var(--font-data)', background: '#fef9c3', padding: '1px 4px', borderRadius: '3px' }}>GEMINI_API_KEY</code> nas variáveis do Vercel.
              Veja <Link href="/settings" style={{ color: '#b45309', fontWeight: 600 }}>Configurações</Link> para instruções.
            </p>
          </div>
        </div>
      )}

      {/* Painel de contexto */}
      {aiContext && <AiContextPanel context={aiContext} />}

      {/* Erro */}
      {error && !isLoading && (
        <div style={{ background: 'var(--color-debit-light)', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
            <AlertCircle size={18} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-debit-text)', marginBottom: '4px' }}>
                Erro ao gerar o dossiê
              </p>
              <p style={{ fontSize: '0.83rem', color: 'var(--color-debit-text)', lineHeight: 1.6 }}>{error}</p>
            </div>
          </div>
          <button
            onClick={generateReport}
            style={{ padding: '8px 16px', background: 'var(--color-surface)', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-debit-text)', fontWeight: 500, fontFamily: 'var(--font-ui)' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Botão de geração — estado inicial */}
      {!reportText && !isLoading && !error && (
        <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <Sparkles size={38} style={{ color: 'var(--color-primary)', margin: '0 auto 14px' }} />
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
            Dossiê Tributário Completo
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 20px' }}>
            A IA irá redigir um relatório técnico completo com 8 seções estruturadas.
            <strong>Tempo estimado:</strong> 1 a 3 minutos dependendo do volume de dados.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
            {['Sumário Executivo','Posição RTC','Conformidade','Por Tipo de Doc','Por CFOP','Evolução Temporal','Recomendações','Conclusão'].map(s => (
              <span key={s} style={{ fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: '20px' }}>
                {s}
              </span>
            ))}
          </div>

          <button
            onClick={generateReport}
            disabled={apiConfigured === false || !aiContext}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 32px',
              background: apiConfigured === false ? 'var(--color-border)' : 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem', fontWeight: 600, cursor: apiConfigured === false ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Sparkles size={17} /> Gerar Dossiê
          </button>
        </div>
      )}

      {/* Indicador de progresso durante geração */}
      {isLoading && (
        <ProgressIndicator elapsed={elapsed} charsReceived={charsReceived} />
      )}

      {/* Relatório concluído */}
      {reportText && !isLoading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)' }}>
            <CheckCircle size={15} color="var(--color-valid)" />
            <p style={{ fontSize: '0.82rem', color: 'var(--color-valid)', fontWeight: 600 }}>
              Dossiê gerado em {elapsed}s — {Math.ceil(reportText.length / 4).toLocaleString('pt-BR')} tokens
            </p>
          </div>
          <AiReport
            markdown={reportText}
            context={aiContext!}
            isLoading={false}
            streamText=""
            companyLogo={companyLogo}
            companyName={companyName}
            onRegenerate={generateReport}
          />
        </>
      )}

      {/* Aviso de privacidade */}
      {aiContext && (
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
          ⚠️ Apenas dados agregados são enviados ao Gemini — sem CNPJs, nomes ou documentos individuais.
          {' '}<Link href="/settings" style={{ color: 'var(--color-primary)' }}>Ver aviso completo</Link>
        </p>
      )}
    </div>
  )
}
