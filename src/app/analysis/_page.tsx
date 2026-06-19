/**
 * @file analysis/page.tsx  (rota "/analysis")
 * @description Dashboard de apuração IBS/CBS — KPIs, gráficos e tabela analítica.
 */
'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Scale, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { useFiscalStore }       from '@/application/store/useFiscalStore'
import { calculateApuracao }    from '@/application/services/TaxAnalyzerService'
import { EmptyState }           from '@/components/ui/EmptyState'
import { Card }                 from '@/components/ui/Card'
import { formatBRL }            from '@/lib/utils'

// ---------------------------------------------------------------------------
// CORES DOS GRÁFICOS
// ---------------------------------------------------------------------------

const C_CREDIT  = '#059669'
const C_DEBIT   = '#dc2626'
const C_NEUTRAL = '#94a3b8'
const PIE_COLORS = ['#1d4ed8','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#64748b']

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------

export default function AnalysisPage() {
  const documents = useFiscalStore(s => s.documents)
  const cnpjRoot  = useFiscalStore(s => s.analyzedCnpjRoot)

  const summary = useMemo(() => calculateApuracao(documents), [documents])

  // --- Dados para o gráfico de CFOP ---
  const cfopData = useMemo(() => {
    const map = new Map<string, { cfop:string; credito:number; debito:number }>()
    for (const doc of documents) {
      for (const item of doc.items) {
        const key = item.cfop || 'N/A'
        const ex  = map.get(key) ?? { cfop:key, credito:0, debito:0 }
        const v   = (item.rtc.vIBS??0) + (item.rtc.vCBS??0)
        if (item.rtc_impact === 'CREDIT') ex.credito += v
        else if (item.rtc_impact === 'DEBIT') ex.debito += v
        map.set(key, ex)
      }
    }
    return Array.from(map.values())
      .filter(d => d.credito > 0 || d.debito > 0)
      .sort((a,b) => (b.credito+b.debito) - (a.credito+a.debito))
      .slice(0, 12)
  }, [documents])

  // --- Dados para o gráfico de CST ---
  const cstData = useMemo(() => {
    const map = new Map<string, number>()
    for (const doc of documents) {
      for (const item of doc.items) {
        if (!item.rtc.cst) continue
        map.set(item.rtc.cst, (map.get(item.rtc.cst)??0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([cst, count]) => ({ name:`CST ${cst}`, value:count }))
      .sort((a,b) => b.value - a.value)
  }, [documents])

  // --- Dados para a tabela por tipo de documento ---
  const byType = useMemo(() => {
    const map = new Map<string, { tipo:string; total:number; credito:number; debito:number; count:number }>()
    for (const doc of documents) {
      const key = doc.document_type
      const ex  = map.get(key) ?? { tipo:key, total:0, credito:0, debito:0, count:0 }
      ex.count++
      ex.total += doc.total_value
      for (const item of doc.items) {
        const v = (item.rtc.vIBS??0) + (item.rtc.vCBS??0)
        if (item.rtc_impact === 'CREDIT') ex.credito += v
        else if (item.rtc_impact === 'DEBIT') ex.debito += v
      }
      map.set(key, ex)
    }
    return Array.from(map.values()).sort((a,b) => b.count - a.count)
  }, [documents])

  if (documents.length === 0) {
    return <EmptyState variant="upload" title="Nenhum documento carregado" description="Carregue XMLs fiscais na tela de Upload para ver a apuração RTC." />
  }

  const saldoPositivo = summary.saldo >= 0

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'20px' }}>

      {/* Aviso sem CNPJ */}
      {!cnpjRoot && (
        <div style={{ display:'flex',gap:'8px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'var(--radius-md)',padding:'12px 16px' }}>
          <AlertCircle size={15} style={{ color:'var(--color-warn)',flexShrink:0,marginTop:'1px' }} />
          <p style={{ fontSize:'0.82rem',color:'#92400e',lineHeight:1.5 }}>
            CNPJ raiz não configurado. Vá para Upload e informe o CNPJ da empresa analisada para calcular créditos e débitos corretamente.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px' }}>
        <KpiCard icon={<TrendingUp size={18} color={C_CREDIT} />}    label="Total Créditos IBS/CBS" value={formatBRL(summary.totalCreditos)} color={C_CREDIT}  />
        <KpiCard icon={<TrendingDown size={18} color={C_DEBIT} />}   label="Total Débitos IBS/CBS"  value={formatBRL(summary.totalDebitos)}  color={C_DEBIT}   />
        <KpiCard icon={<Scale size={18} color={saldoPositivo?C_CREDIT:C_DEBIT} />} label="Saldo do Período" value={formatBRL(Math.abs(summary.saldo))} sub={saldoPositivo?'Posição Credora':'Posição Devedora'} color={saldoPositivo?C_CREDIT:C_DEBIT} />
        <KpiCard icon={<FileText size={18} color="#1d4ed8" />}        label="Total Documentos"       value={String(summary.totalDocumentos)} color="#1d4ed8" />
        <KpiCard icon={<CheckCircle size={18} color={C_CREDIT} />}    label="Docs com IBS/CBS"       value={String(summary.docsComIBSCBS)}   color={C_CREDIT} />
        <KpiCard icon={<AlertCircle size={18} color={C_DEBIT} />}     label="Docs sem IBS/CBS (RPA)" value={String(summary.docsSemIBSCBS)}   color={summary.docsSemIBSCBS>0?C_DEBIT:C_NEUTRAL} />
      </div>

      {/* Gráfico: Créditos e Débitos por CFOP */}
      {cfopData.length > 0 && (
        <Card title="IBS/CBS por CFOP" subtitle="Top CFOPs por impacto tributário">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cfopData} margin={{ top:4,right:20,left:10,bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="cfop" tick={{ fontSize:11,fill:'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize:11,fill:'var(--color-text-muted)' }} tickFormatter={v => formatBRL(v).replace('R$','')} />
              <Tooltip formatter={(v,n) => [formatBRL(Number(v)), n==='credito'?'Crédito':'Débito'] as [string,string]} contentStyle={{ fontSize:'0.8rem',border:'1px solid var(--color-border)',borderRadius:'6px' }} />
              <Legend wrapperStyle={{ fontSize:'0.8rem' }} />
              <Bar dataKey="credito" name="Crédito" fill={C_CREDIT} radius={[3,3,0,0]} />
              <Bar dataKey="debito"  name="Débito"  fill={C_DEBIT}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px' }}>

        {/* Gráfico: Distribuição por CST */}
        {cstData.length > 0 && (
          <Card title="Distribuição por CST" subtitle="Itens por código de situação tributária">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={cstData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,percent}) => `${name} (${((percent??0)*100).toFixed(0)}%)`} labelLine={false} style={{ fontSize:'10px' }}>
                  {cstData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:'0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Tabela: por tipo de documento */}
        <Card title="Resumo por Tipo" subtitle="Créditos e débitos consolidados">
          <table className="data-table" style={{ fontSize:'0.82rem' }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th style={{ textAlign:'right' }}>Docs</th>
                <th style={{ textAlign:'right' }}>Crédito</th>
                <th style={{ textAlign:'right' }}>Débito</th>
                <th style={{ textAlign:'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {byType.map(row => {
                const saldo = row.credito - row.debito
                return (
                  <tr key={row.tipo}>
                    <td><span style={{ fontWeight:600,fontSize:'0.78rem' }}>{row.tipo}</span></td>
                    <td style={{ textAlign:'right',fontFamily:'var(--font-data)' }}>{row.count}</td>
                    <td style={{ textAlign:'right',fontFamily:'var(--font-data)',color:C_CREDIT,fontWeight:row.credito>0?600:400 }}>{row.credito>0?formatBRL(row.credito):'—'}</td>
                    <td style={{ textAlign:'right',fontFamily:'var(--font-data)',color:C_DEBIT,fontWeight:row.debito>0?600:400 }}>{row.debito>0?formatBRL(row.debito):'—'}</td>
                    <td style={{ textAlign:'right',fontFamily:'var(--font-data)',color:saldo>=0?C_CREDIT:C_DEBIT,fontWeight:600 }}>{formatBRL(Math.abs(saldo))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Premissas */}
      <div style={{ background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'12px 16px' }}>
        <p style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--color-text-muted)',marginBottom:'6px' }}>Premissas desta Apuração</p>
        <ul style={{ fontSize:'0.78rem',color:'var(--color-text-secondary)',lineHeight:1.8,paddingLeft:'16px' }}>
          <li>Documentos anteriores a 01/01/2026 não possuem campos IBS/CBS obrigatórios.</li>
          <li>Crédito integral sobre todo IBS/CBS destacado nas entradas (LC 214/2025).</li>
          <li>CFOPs de remessa, bonificação e exportação são classificados como NEUTROS.</li>
          <li>Emitentes Simples Nacional não destacam IBS/CBS — não geram crédito para o adquirente.</li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI CARD
// ---------------------------------------------------------------------------

function KpiCard({ icon,label,value,sub,color }:{ icon:React.ReactNode;label:string;value:string;sub?:string;color:string }) {
  return (
    <div className="kpi-card">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px' }}>
        <p className="kpi-label">{label}</p>
        {icon}
      </div>
      <p className="kpi-value" style={{ color }}>{value}</p>
      {sub && <p style={{ fontSize:'0.75rem',color:'var(--color-text-muted)',marginTop:'4px' }}>{sub}</p>}
    </div>
  )
}
