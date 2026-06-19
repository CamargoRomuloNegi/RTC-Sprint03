/**
 * @file AiReport.tsx
 * @description Renderização e exportação do Dossiê Tributário RTC.
 * Exibe logo e nome da empresa no cabeçalho do relatório exportado.
 */
'use client'

import { useRef }      from 'react'
import ReactMarkdown   from 'react-markdown'
import remarkGfm       from 'remark-gfm'
import { Download, Printer, RefreshCw } from 'lucide-react'
import type { AiContext } from '@/domain/models/AiTypes'

interface Props {
  markdown:     string
  context:      AiContext
  isLoading:    boolean
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  streamText?:  string
  companyLogo?: string
  companyName?: string
  onRegenerate: () => void
}

export function AiReport({ markdown, context, isLoading, streamText: _stream, companyLogo, companyName, onRegenerate }: Props) {
  const reportRef = useRef<HTMLDivElement>(null)
  const display   = isLoading ? (_stream ?? '') : markdown
  if (!display) return null

  const exportHtml = () => {
    const content = reportRef.current?.innerHTML ?? ''
    const html    = buildHtmlDocument(content, context.period, false, companyLogo, companyName)
    const blob    = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url     = URL.createObjectURL(blob)
    const a       = Object.assign(document.createElement('a'), {
      href: url, download: `dossie-rtc-${new Date().toISOString().slice(0,10)}.html`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const content  = reportRef.current?.innerHTML ?? ''
    const html     = buildHtmlDocument(content, context.period, true, companyLogo, companyName)
    const win      = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  return (
    <div>
      {!isLoading && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', marginBottom:'16px', gap:'12px', flexWrap:'wrap' }}>
          <p style={{ fontSize:'0.8rem', color:'var(--color-text-muted)' }}>
            {context.totalDocs.toLocaleString('pt-BR')} documentos • {context.period}
            {companyName && <> • <strong>{companyName}</strong></>}
          </p>
          <div style={{ display:'flex', gap:'8px' }}>
            <Btn icon={<RefreshCw size={13}/>} label="Regenerar"      onClick={onRegenerate} />
            <Btn icon={<Download  size={13}/>} label="Exportar HTML"  onClick={exportHtml} primary />
            <Btn icon={<Printer   size={13}/>} label="Imprimir / PDF" onClick={exportPdf} />
          </div>
        </div>
      )}

      <div ref={reportRef} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)', padding:'32px 36px' }}>
        <div className="ai-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{display}</ReactMarkdown>
        </div>
        {isLoading && (
          <span style={{ display:'inline-block', width:'8px', height:'16px', background:'var(--color-primary)', marginLeft:'2px', animation:'blink 0.8s steps(2) infinite' }} />
        )}
      </div>

      {!isLoading && (
        <p style={{ fontSize:'0.72rem', color:'var(--color-text-muted)', textAlign:'center', marginTop:'12px' }}>
          Gerado por IA (Google Gemini) com dados agregados — sem identificação de empresas.
          Revise os valores com seu contador antes de tomar decisões.
        </p>
      )}

      <style>{`@keyframes blink{0%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  )
}

function Btn({ icon, label, onClick, primary }: { icon:React.ReactNode; label:string; onClick:()=>void; primary?:boolean }) {
  return (
    <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'var(--radius-sm)', border: primary?'none':'1px solid var(--color-border)', background: primary?'var(--color-primary)':'var(--color-surface)', color: primary?'#fff':'var(--color-text-secondary)', fontSize:'0.78rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-ui)', whiteSpace:'nowrap' }}>
      {icon}{label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// GERADOR DE HTML AUTOCONTIDO
// ---------------------------------------------------------------------------

function buildHtmlDocument(body: string, period: string, forPrint: boolean, logo?: string, companyName?: string): string {
  const logoHtml = logo
    ? `<img src="${logo}" alt="Logo" style="max-height:52px;max-width:200px;object-fit:contain;">`
    : `<div style="width:48px;height:48px;border-radius:10px;background:#1d4ed8;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;">R</div>`

  const preparedBy = companyName
    ? `<div style="text-align:right"><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Preparado por</div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:2px">${companyName}</div></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dossiê Tributário RTC — ${period}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;background:#f8fafc;padding:0}
.container{max-width:860px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 52px}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;margin-bottom:32px;border-bottom:2px solid #1d4ed8;gap:16px}
.header-left{display:flex;align-items:center;gap:14px}
.header-meta{display:flex;flex-direction:column;gap:2px}
.header-title{font-size:12px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;font-weight:600}
.header-period{font-size:15px;font-weight:700;color:#1d4ed8}
.header-date{font-size:11px;color:#94a3b8;margin-top:2px}
h1{font-size:1.55rem;font-weight:800;color:#0f172a;margin-bottom:8px}
h2{font-size:1.1rem;font-weight:700;color:#1d4ed8;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #dbeafe}
h3{font-size:.98rem;font-weight:600;color:#1e293b;margin:16px 0 7px}
p{margin-bottom:12px;color:#334155}
strong{font-weight:700;color:#0f172a}
em{font-style:italic;color:#475569}
ul,ol{padding-left:20px;margin-bottom:14px}
li{margin-bottom:5px;color:#334155}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th{background:#f1f5f9;padding:9px 12px;text-align:left;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#475569;border:1px solid #e2e8f0}
td{padding:9px 12px;border:1px solid #e2e8f0;color:#334155}
tr:nth-child(even) td{background:#f8fafc}
code{font-family:'Consolas',monospace;font-size:12px;background:#f1f5f9;padding:1px 5px;border-radius:3px;color:#1d4ed8}
blockquote{border-left:4px solid #1d4ed8;padding-left:14px;color:#475569;margin:12px 0;font-style:italic}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6}
@media print{
  body{background:#fff}
  .container{box-shadow:none;margin:0;max-width:100%;border-radius:0;padding:24px 32px}
  h2{page-break-after:avoid}
  p,li{orphans:3;widows:3}
  .footer{page-break-inside:avoid}
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <div class="header-meta">
        <div class="header-title">Dossiê Tributário RTC — IBS/CBS</div>
        <div class="header-period">${period}</div>
        <div class="header-date">Gerado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    ${preparedBy}
  </div>

  ${body}

  <div class="footer">
    Gerado pelo Simples Apuração RTC • Análise assistida por IA (Google Gemini) •
    Os dados enviados ao Gemini são exclusivamente estatísticas agregadas, sem identificação de empresas.<br>
    Revise os valores com seu contador antes de tomar decisões tributárias.
    ${companyName ? `• ${companyName}` : ''}
  </div>
</div>
${forPrint ? '<script>window.onload=()=>{window.print()}</script>' : ''}
</body>
</html>`
}
