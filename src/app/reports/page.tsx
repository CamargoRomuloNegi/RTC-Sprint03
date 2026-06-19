/**
 * @file reports/page.tsx  (rota "/reports")
 * @description Relatório de conformidade — documentos RPA sem IBS/CBS, ranking de fornecedores.
 */
'use client'

import { useMemo, useState } from 'react'
import { Download, AlertTriangle, CheckCircle, Building2 } from 'lucide-react'
import { useFiscalStore }            from '@/application/store/useFiscalStore'
import { getInconformes, groupByCnpjEmitente } from '@/application/services/TaxAnalyzerService'
import { exportInconformesToCsv }    from '@/application/services/ExportService'
import { EmptyState }                from '@/components/ui/EmptyState'
import { Card }                      from '@/components/ui/Card'
import { Button }                    from '@/components/ui/Button'
import { docTypeBadge }              from '@/components/ui/Badge'
import { formatBRL, formatCnpjCpf, truncate } from '@/lib/utils'

export default function ReportsPage() {
  const documents = useFiscalStore(s => s.documents)
  const [tab, setTab] = useState<'inconformes' | 'fornecedores'>('inconformes')

  const inconformes = useMemo(() => getInconformes(documents), [documents])
  const inboundDocs = useMemo(() => documents.filter(d => d.direction === 'INBOUND'), [documents])

  // Ranking de fornecedores por volume sem IBS/CBS
  const fornecedores = useMemo(() => {
    const inconf = getInconformes(documents)
    const grouped = groupByCnpjEmitente(inconf)
    return Array.from(grouped.entries())
      .map(([cnpj, { name, docs }]) => ({
        cnpj, name,
        totalDocs:   docs.length,
        totalValue:  docs.reduce((s, d) => s + d.total_value, 0),
      }))
      .sort((a, b) => b.totalDocs - a.totalDocs)
  }, [documents])

  if (documents.length === 0) {
    return <EmptyState variant="upload" title="Nenhum documento carregado" description="Carregue XMLs fiscais para analisar a conformidade da sua carteira de fornecedores." />
  }

  const conformidadeRate = inboundDocs.length > 0
    ? Math.round(((inboundDocs.length - inconformes.length) / inboundDocs.length) * 100)
    : 100

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'20px' }}>

      {/* KPIs de conformidade */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px' }}>
        <div className="kpi-card">
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px' }}>
            <p className="kpi-label">Taxa de Conformidade</p>
            {conformidadeRate >= 80
              ? <CheckCircle size={18} color="#059669" />
              : <AlertTriangle size={18} color="#dc2626" />}
          </div>
          <p className="kpi-value" style={{ color: conformidadeRate >= 80 ? '#059669' : '#dc2626' }}>
            {conformidadeRate}%
          </p>
          <p style={{ fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'4px' }}>Das entradas de RPA</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label" style={{ marginBottom:'10px' }}>Inconformes</p>
          <p className="kpi-value" style={{ color: inconformes.length > 0 ? '#dc2626' : '#059669' }}>{inconformes.length}</p>
          <p style={{ fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'4px' }}>Docs RPA sem IBS/CBS</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label" style={{ marginBottom:'10px' }}>Fornecedores Inconformes</p>
          <p className="kpi-value" style={{ color: fornecedores.length > 0 ? '#d97706' : '#059669' }}>{fornecedores.length}</p>
          <p style={{ fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'4px' }}>Emitentes únicos</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label" style={{ marginBottom:'10px' }}>Total Docs Analisados</p>
          <p className="kpi-value" style={{ color:'#1d4ed8' }}>{inboundDocs.length}</p>
          <p style={{ fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'4px' }}>Entradas (INBOUND)</p>
        </div>
      </div>

      {/* Aviso zero inconformes */}
      {inconformes.length === 0 && inboundDocs.length > 0 && (
        <div style={{ display:'flex',gap:'8px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'var(--radius-md)',padding:'14px 16px' }}>
          <CheckCircle size={16} style={{ color:'#059669',flexShrink:0,marginTop:'1px' }} />
          <div>
            <p style={{ fontSize:'0.85rem',fontWeight:600,color:'#166534',marginBottom:'3px' }}>Carteira em conformidade</p>
            <p style={{ fontSize:'0.8rem',color:'#166534',lineHeight:1.5 }}>
              Todos os documentos de entrada de emitentes RPA possuem IBS/CBS destacados.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {(inconformes.length > 0 || fornecedores.length > 0) && (
        <>
          <div style={{ display:'flex',borderBottom:'1px solid var(--color-border)',gap:'0' }}>
            {(['inconformes','fornecedores'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ padding:'8px 18px',border:'none',borderBottom:`2px solid ${tab===t?'var(--color-primary)':'transparent'}`,background:'none',cursor:'pointer',fontSize:'0.85rem',fontWeight:tab===t?600:400,color:tab===t?'var(--color-primary)':'var(--color-text-secondary)',fontFamily:'var(--font-ui)',transition:'all 0.15s' }}
              >
                {t === 'inconformes' ? `Documentos Inconformes (${inconformes.length})` : `Ranking Fornecedores (${fornecedores.length})`}
              </button>
            ))}
          </div>

          {/* Tab: Documentos inconformes */}
          {tab === 'inconformes' && (
            <Card
              title="Documentos sem IBS/CBS"
              subtitle="Emitentes RPA que não destacaram IBS/CBS em 2026+"
              actions={
                <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={() => exportInconformesToCsv(inconformes)}>
                  Exportar CSV
                </Button>
              }
              noPadding
            >
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Data</th>
                      <th>Emitente</th>
                      <th>CNPJ Emitente</th>
                      <th style={{ textAlign:'right' }}>Valor Total</th>
                      <th>Chave (resumo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconformes.map(doc => (
                      <tr key={doc.access_key}>
                        <td>{docTypeBadge(doc.document_type)}</td>
                        <td style={{ fontFamily:'var(--font-data)',fontSize:'0.78rem',color:'var(--color-text-secondary)',whiteSpace:'nowrap' }}>{fmtDate(doc.issue_date)}</td>
                        <td style={{ fontSize:'0.83rem',fontWeight:500 }}>{truncate(doc.issuer.name,30)}</td>
                        <td style={{ fontFamily:'var(--font-data)',fontSize:'0.78rem' }}>{formatCnpjCpf(doc.issuer.cnpj_cpf)}</td>
                        <td style={{ textAlign:'right',fontFamily:'var(--font-data)',fontSize:'0.83rem',fontWeight:500 }}>{formatBRL(doc.total_value)}</td>
                        <td style={{ fontFamily:'var(--font-data)',fontSize:'0.7rem',color:'var(--color-text-muted)' }}>{doc.access_key.slice(0,20)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Tab: Ranking de fornecedores */}
          {tab === 'fornecedores' && (
            <Card title="Ranking de Fornecedores Inconformes" subtitle="Ordenado por quantidade de documentos sem IBS/CBS" noPadding>
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width:'36px' }}>#</th>
                      <th>Fornecedor</th>
                      <th>CNPJ</th>
                      <th style={{ textAlign:'right' }}>Docs Inconformes</th>
                      <th style={{ textAlign:'right' }}>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedores.map(({ cnpj,name,totalDocs,totalValue }, i) => (
                      <tr key={cnpj}>
                        <td style={{ fontFamily:'var(--font-data)',fontSize:'0.78rem',color:'var(--color-text-muted)',fontWeight:600 }}>{i+1}</td>
                        <td>
                          <div style={{ display:'flex',alignItems:'center',gap:'7px' }}>
                            <Building2 size={13} style={{ color:'var(--color-text-muted)',flexShrink:0 }} />
                            <span style={{ fontSize:'0.83rem',fontWeight:500 }}>{truncate(name,32)}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily:'var(--font-data)',fontSize:'0.78rem' }}>{formatCnpjCpf(cnpj)}</td>
                        <td style={{ textAlign:'right',fontFamily:'var(--font-data)',fontSize:'0.88rem',fontWeight:700,color:'#dc2626' }}>{totalDocs}</td>
                        <td style={{ textAlign:'right',fontFamily:'var(--font-data)',fontSize:'0.85rem',fontWeight:500 }}>{formatBRL(totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Critérios */}
      <div style={{ background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'12px 16px' }}>
        <p style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--color-text-muted)',marginBottom:'6px' }}>Critérios de Inconformidade</p>
        <ul style={{ fontSize:'0.78rem',color:'var(--color-text-secondary)',lineHeight:1.8,paddingLeft:'16px' }}>
          <li>Documento de entrada (INBOUND) emitido a partir de 01/01/2026</li>
          <li>Emitente em Regime Normal (RPA, CRT 3)</li>
          <li>Soma de IBS + CBS igual a zero</li>
          <li>Simples Nacional não é considerado inconformidade — regime não destaca IBS/CBS</li>
        </ul>
      </div>
    </div>
  )
}

function fmtDate(iso:string):string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) } catch { return '—' }
}
