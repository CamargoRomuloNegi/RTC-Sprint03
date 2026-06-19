/**
 * @file ai/page.tsx  (rota "/ai")
 * @description Consultor IA — gera o Dossiê Tributário RTC automaticamente.
 *
 * FILOSOFIA Sprint 4 v2:
 *   Não há perguntas livres. Com um clique, a IA analisa todos os dados
 *   carregados e produz um dossiê profissional com 8 seções estruturadas.
 *   O usuário pode exportar como HTML (para e-mail) ou PDF (via impressão).
 *
 * FLUXO:
 *   1. Sem documentos → EmptyState
 *   2. API não configurada → aviso com instruções
 *   3. Com documentos + API → botão "Gerar Dossiê" → relatório completo
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, AlertCircle, Settings }   from 'lucide-react'
import Link                                   from 'next/link'
import { useFiscalStore }    from '@/application/store/useFiscalStore'
import { useAiStore }        from '@/application/store/useAiStore'
import { buildAiContext }    from '@/application/services/AiContextService'
import { AiContextPanel }    from '@/components/ai/AiContextPanel'
import { AiReport }          from '@/components/ai/AiReport'
import { EmptyState }        from '@/components/ui/EmptyState'
import type { AiContext }    from '@/domain/models/AiTypes'

export default function AiPage() {
  const documents = useFiscalStore(s => s.documents)
  const { model, maxTokens, setLoading, setError, isLoading, error } = useAiStore()

  const [streamText,    setStreamText]    = useState('')
  const [reportText,    setReportText]    = useState('')
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [aiContext,     setAiContext]      = useState<AiContext | null>(null)

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

  // Construir contexto quando documentos mudam
  useEffect(() => {
    setAiContext(documents.length > 0 ? buildAiContext(documents) : null)
  }, [documents])

  // ---------------------------------------------------------------------------
  // GERAR DOSSIÊ
  // ---------------------------------------------------------------------------

  const generateReport = useCallback(async () => {
    if (!aiContext || isLoading) return

    setLoading(true)
    setError(null)
    setStreamText('')
    setReportText('')

    try {
      const response = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          context:   aiContext,
          model:     model,
          maxTokens: Math.max(maxTokens, 4096), // dossiê precisa de mais tokens
        }),
      })

      if (!response.ok) {
        const err = await response.json() as { error?: string }
        throw new Error(err.error ?? `Erro ${response.status}`)
      }

      // Consumir stream progressivamente
      const reader  = response.body!.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamText(full)
      }

      setReportText(full)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao gerar o dossiê.')
    } finally {
      setLoading(false)
      setStreamText('')
    }
  }, [aiContext, isLoading, model, maxTokens, setLoading, setError])

  // ---------------------------------------------------------------------------
  // ESTADOS DE GUARDA
  // ---------------------------------------------------------------------------

  if (documents.length === 0) {
    return (
      <EmptyState
        variant="upload"
        title="Nenhum documento carregado"
        description="Carregue XMLs fiscais na tela de Upload para gerar o Dossiê Tributário."
      />
    )
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
        <Link href="/settings" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          <Settings size={13} /> Configurações
        </Link>
      </div>

      {/* Aviso: API não configurada */}
      {apiConfigured === false && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-warn)', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>
              Módulo de IA não configurado
            </p>
            <p style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.5 }}>
              Adicione <code style={{ fontFamily: 'var(--font-data)', background: '#fef9c3', padding: '1px 4px', borderRadius: '3px' }}>GEMINI_API_KEY</code> nas variáveis de ambiente do Vercel.
              Obtenha uma chave gratuita em{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#b45309', fontWeight: 600 }}>aistudio.google.com</a>.
              Veja <Link href="/settings" style={{ color: '#b45309', fontWeight: 600 }}>Configurações</Link> para detalhes.
            </p>
          </div>
        </div>
      )}

      {/* Painel de contexto */}
      {aiContext && <AiContextPanel context={aiContext} />}

      {/* Erro */}
      {error && (
        <div style={{ background: 'var(--color-debit-light)', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-debit-text)', fontWeight: 600, marginBottom: '4px' }}>
            Erro ao gerar o dossiê
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-debit-text)', lineHeight: 1.5 }}>{error}</p>
          <button onClick={generateReport} style={{ marginTop: '10px', padding: '6px 14px', background: 'var(--color-surface)', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-debit-text)' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Botão de geração — exibido quando não há relatório ou durante loading */}
      {!reportText && !isLoading && !error && (
        <div style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ marginBottom: '16px' }}>
            <Sparkles size={36} style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
              Dossiê Tributário Completo
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
              Clique em <strong>Gerar Dossiê</strong> para que a IA analise seus dados e produza um relatório completo com sumário executivo, análise de posição RTC, conformidade, distribuição por tipo, CFOPs, evolução temporal e recomendações.
            </p>
          </div>

          {/* Seções que serão geradas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', margin: '16px 0' }}>
            {['Sumário Executivo', 'Posição RTC', 'Conformidade', 'Por Tipo de Doc', 'Por CFOP', 'Evolução Temporal', 'Recomendações', 'Conclusão'].map(s => (
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
              padding: '12px 28px', background: apiConfigured === false ? 'var(--color-border)' : 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem', fontWeight: 600, cursor: apiConfigured === false ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-ui)', marginTop: '8px',
            }}
          >
            <Sparkles size={17} />
            Gerar Dossiê
          </button>
        </div>
      )}

      {/* Relatório em geração / concluído */}
      {(isLoading || reportText) && aiContext && (
        <AiReport
          markdown={reportText}
          context={aiContext}
          isLoading={isLoading}
          streamText={streamText}
          onRegenerate={generateReport}
        />
      )}

      {/* Aviso de privacidade compacto */}
      {aiContext && (
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
          ⚠️ Apenas dados agregados são enviados ao Gemini — sem CNPJs, nomes ou documentos individuais.
          No plano gratuito, o Google pode usar os dados para melhorar seus modelos.{' '}
          <Link href="/settings" style={{ color: 'var(--color-primary)' }}>Ver aviso completo</Link>
        </p>
      )}
    </div>
  )
}
