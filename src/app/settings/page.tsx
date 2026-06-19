/**
 * @file settings/page.tsx (rota "/settings")
 * @description Configurações do Módulo de IA — modelo, logo da empresa e status.
 */
'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Bot, CheckCircle, XCircle, AlertTriangle,
  Info, Upload, X, Building2,
} from 'lucide-react'
import { useAiStore }        from '@/application/store/useAiStore'
import { GEMINI_MODELS }     from '@/domain/models/AiTypes'
import type { GeminiModel }  from '@/domain/models/AiTypes'
import { Card }              from '@/components/ui/Card'

export default function SettingsPage() {
  const {
    model, setModel,
    companyLogo, setCompanyLogo,
    companyName, setCompanyName,
  } = useAiStore()

  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [checkingApi,   setCheckingApi]   = useState(true)
  const [logoError,     setLogoError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reidratar store (skipHydration)
  useEffect(() => {
    useAiStore.persist.rehydrate()
  }, [])

  // Verificar status da chave no servidor
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then((d: { configured: boolean }) => setApiConfigured(d.configured))
      .catch(() => setApiConfigured(false))
      .finally(() => setCheckingApi(false))
  }, [])

  // Upload de logo — converte para base64, valida tamanho e tipo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')

    if (!file.type.startsWith('image/')) {
      setLogoError('Apenas imagens são aceitas (PNG, JPG, SVG).')
      return
    }
    if (file.size > 500_000) {
      setLogoError('Imagem muito grande. Use até 500KB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') setCompanyLogo(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Configurações
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Parâmetros operacionais do Módulo de IA e identidade do dossiê
        </p>
      </div>

      {/* Status da API */}
      <Card title="Status do Sistema">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {checkingApi ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-border)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Verificando…</span>
            </div>
          ) : apiConfigured ? (
            <>
              <CheckCircle size={20} color="var(--color-valid)" />
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-valid)' }}>Chave Gemini configurada</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  GEMINI_API_KEY detectada nas variáveis de ambiente do servidor
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle size={20} color="var(--color-error)" />
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-error)' }}>Chave não configurada</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Adicione <code style={{ fontFamily: 'var(--font-data)', background: 'var(--color-bg)', padding: '1px 4px', borderRadius: '3px' }}>GEMINI_API_KEY</code> nas variáveis do Vercel.{' '}
                  Chave gratuita em{' '}
                  <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>aistudio.google.com</a>
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Identidade do Dossiê */}
      <Card title="Identidade do Dossiê" subtitle="Logo e nome exibidos no cabeçalho do relatório exportado">

        {/* Nome da empresa */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Nome da Empresa / Escritório
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={companyName ?? ''}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Ex: Escritório Silva & Associados ou Nome da Empresa"
              maxLength={80}
              style={{
                flex: 1, height: '36px', padding: '0 12px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem', fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-primary)', background: 'var(--color-bg)',
              }}
            />
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Aparece no cabeçalho do dossiê como "Preparado por"
          </p>
        </div>

        {/* Upload de logo */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Logotipo
          </label>

          {companyLogo ? (
            /* Preview da logo carregada */
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <img
                src={companyLogo}
                alt="Logo da empresa"
                style={{ maxHeight: '48px', maxWidth: '180px', objectFit: 'contain' }}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>Logo carregada</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Será exibida no cabeçalho do dossiê exportado
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                >
                  Trocar
                </button>
                <button
                  onClick={() => { setCompanyLogo(undefined); setLogoError('') }}
                  style={{ padding: '5px 8px', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', background: '#fef2f2', cursor: 'pointer', color: 'var(--color-error)' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            /* Área de upload */
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '24px', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', background: 'var(--color-bg)', transition: 'all 0.15s', gap: '8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <Upload size={22} style={{ color: 'var(--color-text-muted)' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                Clique para carregar o logotipo
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                PNG, JPG ou SVG — até 500KB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLogoUpload}
          />

          {logoError && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-error)', marginTop: '6px' }}>{logoError}</p>
          )}

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <Info size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              O logo é armazenado apenas no navegador (localStorage). Nenhuma imagem é enviada ao servidor ou ao Gemini.
            </p>
          </div>
        </div>
      </Card>

      {/* Modelo de IA */}
      <Card title="Modelo de IA" subtitle="Selecione o modelo Gemini para geração do dossiê">
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
                type="radio" name="model" value={m.id}
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

        {/* Nota sobre tokens */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
          <Info size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '0.77rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            O dossiê usa o máximo de tokens que o modelo suporta para garantir completude.
            O Free Tier limita <strong>15 requisições/minuto</strong> — não o tamanho de cada resposta.
          </p>
        </div>
      </Card>

      {/* Aviso de privacidade */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
        <AlertTriangle size={18} style={{ color: 'var(--color-warn)', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
            Aviso de Privacidade — Módulo de IA
          </p>
          <p style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.6 }}>
            Ao gerar o dossiê, um <strong>sumário estatístico</strong> é enviado ao Google Gemini.
            <strong> O que é enviado:</strong> totais agregados, percentuais, CFOPs.
            <strong> O que NÃO é enviado:</strong> CNPJs, nomes de empresas, chaves ou documentos individuais.
          </p>
          <p style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '6px' }}>
            No plano gratuito, o Google pode usar dados para melhorar seus modelos. Para dados confidenciais, use uma chave do plano pago em{' '}
            <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#b45309', fontWeight: 600 }}>aistudio.google.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
