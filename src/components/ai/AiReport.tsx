/**
 * @file AiReport.tsx
 * @description Renderização e exportação do Dossiê Tributário RTC gerado pela IA.
 *
 * EXPORTAÇÃO:
 *   HTML: gera arquivo .html autocontido com estilos inline — abre no browser,
 *         imprime e pode ser enviado por e-mail como anexo.
 *   PDF:  aciona window.print() com CSS @media print otimizado.
 *         O browser converte para PDF via "Salvar como PDF".
 *
 * Nenhuma biblioteca adicional necessária para exportação.
 */
'use client'

import { useRef }        from 'react'
import ReactMarkdown     from 'react-markdown'
import { Download, Printer, RefreshCw } from 'lucide-react'
import type { AiContext } from '@/domain/models/AiTypes'

interface Props {
  markdown:   string
  context:    AiContext
  isLoading:  boolean
  streamText: string
  onRegenerate: () => void
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export function AiReport({ markdown, context, isLoading, streamText, onRegenerate }: Props) {
  const reportRef = useRef<HTMLDivElement>(null)

  const displayText = isLoading ? streamText : markdown
  if (!displayText) return null

  // --- EXPORTAR HTML ---
  const exportHtml = () => {
    const content = reportRef.current?.innerHTML ?? ''
    const html    = buildHtmlDocument(content, context.period)
    const blob    = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url     = URL.createObjectURL(blob)
    const a       = Object.assign(document.createElement('a'), {
      href:     url,
      download: `dossie-rtc-${new Date().toISOString().slice(0, 10)}.html`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- EXPORTAR PDF (via impressão do browser) ---
  const exportPdf = () => {
    const content  = reportRef.current?.innerHTML ?? ''
    const html     = buildHtmlDocument(content, context.period, true)
    const printWin = window.open('', '_blank')
    if (!printWin) return
    printWin.document.write(html)
    printWin.document.close()
    printWin.onload = () => {
      printWin.focus()
      printWin.print()
    }
  }

  return (
    <div>
      {/* Toolbar de ações */}
      {!isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Dossiê gerado com <strong>{context.totalDocs.toLocaleString('pt-BR')}</strong> documentos — {context.period}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ActionButton icon={<RefreshCw size={13} />} label="Regenerar" onClick={onRegenerate} />
            <ActionButton icon={<Download  size={13} />} label="Exportar HTML" onClick={exportHtml} primary />
            <ActionButton icon={<Printer   size={13} />} label="Imprimir / PDF" onClick={exportPdf} />
          </div>
        </div>
      )}

      {/* Conteúdo do relatório */}
      <div
        ref={reportRef}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 36px',
        }}
      >
        <div className="ai-markdown">
          <ReactMarkdown>{displayText}</ReactMarkdown>
        </div>

        {/* Indicador de geração em progresso */}
        {isLoading && (
          <span style={{
            display: 'inline-block', width: '8px', height: '16px',
            background: 'var(--color-primary)', marginLeft: '2px',
            animation: 'blink 0.8s steps(2) infinite',
          }} />
        )}
      </div>

      {/* Rodapé */}
      {!isLoading && (
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '12px' }}>
          Gerado por {context.period} • Apenas dados agregados foram enviados ao Gemini •
          Revise os valores com seu contador antes de tomar decisões
        </p>
      )}

      <style>{`
        @keyframes blink { 0% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BOTÃO DE AÇÃO
// ---------------------------------------------------------------------------

function ActionButton({ icon, label, onClick, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '6px 12px', borderRadius: 'var(--radius-sm)',
        border: primary ? 'none' : '1px solid var(--color-border)',
        background: primary ? 'var(--color-primary)' : 'var(--color-surface)',
        color: primary ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {icon}{label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// GERADOR DE HTML AUTOCONTIDO
// ---------------------------------------------------------------------------

function buildHtmlDocument(bodyContent: string, period: string, forPrint = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossiê Tributário RTC — ${period}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px; line-height: 1.7;
      color: #0f172a; background: #f8fafc;
      padding: 0;
    }
    .container {
      max-width: 860px; margin: 40px auto;
      background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 48px 52px;
    }
    /* Cabeçalho do documento */
    .doc-header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 20px; margin-bottom: 32px;
      border-bottom: 2px solid #1d4ed8;
    }
    .doc-title { font-size: 13px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; }
    .doc-period { font-size: 15px; font-weight: 700; color: #1d4ed8; }
    .doc-date { font-size: 12px; color: #94a3b8; }
    /* Tipografia */
    h1 { font-size: 1.6rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    h2 { font-size: 1.15rem; font-weight: 700; color: #1d4ed8; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #dbeafe; }
    h3 { font-size: 1rem; font-weight: 600; color: #1e293b; margin: 18px 0 8px; }
    p  { margin-bottom: 12px; color: #334155; }
    strong { font-weight: 700; color: #0f172a; }
    em     { font-style: italic; color: #475569; }
    ul, ol { padding-left: 20px; margin-bottom: 14px; }
    li     { margin-bottom: 6px; color: #334155; }
    code   {
      font-family: 'Consolas', monospace; font-size: 12px;
      background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
      color: #1d4ed8;
    }
    blockquote {
      border-left: 4px solid #1d4ed8; padding-left: 14px;
      color: #475569; margin: 12px 0; font-style: italic;
    }
    /* Rodapé */
    .doc-footer {
      margin-top: 40px; padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px; color: #94a3b8; text-align: center;
    }
    @media print {
      body { background: #fff; }
      .container { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; padding: 24px 32px; }
      h2 { page-break-after: avoid; }
      p, li { orphans: 3; widows: 3; }
      .doc-footer { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="doc-header">
      <div>
        <div class="doc-title">Dossiê Tributário RTC — IBS/CBS</div>
        <div class="doc-period">${period}</div>
      </div>
      <div class="doc-date">Gerado em ${new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}</div>
    </div>

    ${bodyContent}

    <div class="doc-footer">
      Gerado pelo Simples Apuração RTC • Análise assistida por IA (Google Gemini) •
      Os dados enviados ao Gemini são exclusivamente estatísticas agregadas, sem identificação de empresas.
      Revise os valores com seu contador antes de tomar decisões tributárias.
    </div>
  </div>
  ${forPrint ? '<script>window.onload=()=>{window.print()}</script>' : ''}
</body>
</html>`
}
