/**
 * @file analysis/page.tsx  (rota "/analysis")
 * @description Dashboard de apuração IBS/CBS — KPIs com índices percentuais, gráficos e tabela analítica.
 *
 * AJUSTES v2:
 *   - KPIs de crédito, débito e saldo: cartões maiores com índice % abaixo do valor
 *     O índice % representa o peso do IBS/CBS sobre o volume financeiro da direção:
 *       Crédito %  = IBS/CBS creditados / valor total das entradas INBOUND
 *       Débito  %  = IBS/CBS debitados  / valor total das saídas  OUTBOUND
 *       Saldo   %  = saldo líquido      / valor total de todos os documentos
 *   - Cards de contagem de documentos reformatados: label + quantidade em linha
 *     mais limpa, sem ocupar o mesmo peso visual dos cards financeiros.
 */
'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Scale, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useFiscalStore }       from '@/application/store/useFiscalStore'
import { calculateApuracao }    from '@/application/services/TaxAnalyzerService'
import { EmptyState }           from '@/components/ui/EmptyState'
import { Card }                 from '@/components/ui/Card'
import { formatBRL } from '@/lib/utils'

// ---------------------------------------------------------------------------
// PALETA
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

  // --- Volumes financeiros por direção (base dos índices percentuais) ---
  const { inboundValue, outboundValue } = useMemo(() => {
    let inbound = 0, outbound = 0
    for (const doc of documents) {
      if (doc.direction === 'INBOUND')  inbound  += doc.total_value
      if (doc.direction === 'OUTBOUND') outbound += doc.total_value
    }
    return { inboundValue: inbound, outboundValue: outbound }
  }, [documents])

  /**
   * Índice de Crédito (%):
   *   IBS/CBS creditados ÷ valor total das entradas (INBOUND)
   *   Representa a carga efetiva de IBS/CBS sobre as compras
   */
  const creditRate  = inboundValue  > 0 ? (summary.totalCreditos  / inboundValue)         * 100 : 0

  /**
   * Índice de Débito (%):
   *   IBS/CBS debitados ÷ valor total das saídas (OUTBOUND)
   *   Representa a carga efetiva de IBS/CBS sobre as vendas
   */
  const debitRate   = outboundValue > 0 ? (summary.totalDebitos   / outboundValue)        * 100 : 0

  /**
   * Índice de Saldo (%):
   *   Saldo líquido ÷ volume total de todos os documentos
   *   Representa o peso da posição credora/devedora sobre o volume transacionado
   */
  const balanceRate = outboundValue > 0 ? (Math.abs(summary.saldo) / outboundValue)       * 100 : 0

  const saldoPositivo = summary.saldo >= 0

  // --- Dados para o gráfico de CFOP ---
  const cfopData = useMemo(() => {
    const map = new Map<string, { cfop:string; credito:number; debito:number }>()
    for (const doc of documents) {
      for (const item of doc.items) {
        const key = item.cfop || 'N/A'
        const ex  = map.get(key) ?? { cfop: key, credito: 0, debito: 0 }
        const v   = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
        if (item.rtc_impact === 'CREDIT') ex.credito += v
        else if (item.rtc_impact === 'DEBIT') ex.debito += v
        map.set(key, ex)
      }
    }
    return Array.from(map.values())
      .filter(d => d.credito > 0 || d.debito > 0)
      .sort((a, b) => (b.credito + b.debito) - (a.credito + a.debito))
      .slice(0, 12)
  }, [documents])

  // --- Dados para o gráfico de CST ---
  const cstData = useMemo(() => {
    const map = new Map<string, number>()
    for (const doc of documents) {
      for (const item of doc.items) {
        if (!item.rtc.cst) continue
        map.set(item.rtc.cst, (map.get(item.rtc.cst) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([cst, count]) => ({ name: `CST ${cst}`, value: count }))
      .sort((a, b) => b.value - a.value)
  }, [documents])

  // --- Resumo por tipo de documento ---
  const byType = useMemo(() => {
    const map = new Map<string, { tipo:string; total:number; credito:number; debito:number; count:number }>()
    for (const doc of documents) {
      const key = doc.document_type
      const ex  = map.get(key) ?? { tipo: key, total: 0, credito: 0, debito: 0, count: 0 }
      ex.count++
      ex.total += doc.total_value
      for (const item of doc.items) {
        const v = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
        if (item.rtc_impact === 'CREDIT') ex.credito += v
        else if (item.rtc_impact === 'DEBIT') ex.debito += v
      }
      map.set(key, ex)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [documents])

  if (documents.length === 0) {
    return <EmptyState variant="upload" title="Nenhum documento carregado" description="Carregue XMLs fiscais na tela de Upload para ver a apuração RTC." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Aviso sem CNPJ */}
      {!cnpjRoot && (
        <div style={{ display: 'flex', gap: '8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
          <AlertCircle size={15} style={{ color: 'var(--color-warn)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.5 }}>
            CNPJ raiz não configurado. Vá para Upload e informe o CNPJ da empresa analisada para calcular créditos e débitos corretamente.
          </p>
        </div>
      )}

      {/* ─── BLOCO 1: KPIs FINANCEIROS (Crédito, Débito, Saldo) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

        {/* Crédito */}
        <FinancialKpi
          icon={<TrendingUp size={20} color={C_CREDIT} />}
          label="Total Créditos IBS/CBS"
          value={formatBRL(summary.totalCreditos)}
          rate={creditRate}
          rateLabel={`${formatPercent(creditRate)} do valor das entradas`}
          rateTitle="Índice de Crédito = IBS/CBS creditados ÷ total das compras (INBOUND)"
          color={C_CREDIT}
          baseLabel="Base: entradas"
          baseValue={formatBRL(inboundValue)}
        />

        {/* Débito */}
        <FinancialKpi
          icon={<TrendingDown size={20} color={C_DEBIT} />}
          label="Total Débitos IBS/CBS"
          value={formatBRL(summary.totalDebitos)}
          rate={debitRate}
          rateLabel={`${formatPercent(debitRate)} do valor das saídas`}
          rateTitle="Índice de Débito = IBS/CBS debitados ÷ total das vendas (OUTBOUND)"
          color={C_DEBIT}
          baseLabel="Base: saídas"
          baseValue={formatBRL(outboundValue)}
        />

        {/* Saldo */}
        <FinancialKpi
          icon={<Scale size={20} color={saldoPositivo ? C_CREDIT : C_DEBIT} />}
          label="Saldo do Período"
          value={formatBRL(Math.abs(summary.saldo))}
          sub={saldoPositivo ? '▲ Posição Credora' : '▼ Posição Devedora'}
          rate={balanceRate}
          rateLabel={`${formatPercent(balanceRate)} do valor das saídas`}
          rateTitle="Índice de Saldo = |saldo líquido| ÷ total das vendas (OUTBOUND) — para cada R$ vendido, quanto é posição credora/devedora de IBS/CBS"
          color={saldoPositivo ? C_CREDIT : C_DEBIT}
          baseLabel="Base: saídas"
          baseValue={formatBRL(outboundValue)}
        />
      </div>

      {/* ─── BLOCO 2: CONTADORES DE DOCUMENTOS (compactos) ─── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        flexWrap: 'wrap',
      }}>
        <DocCount label="Total de Documentos"    value={summary.totalDocumentos}  color="var(--color-primary)"     icon={null} />
        <Divider />
        <DocCount label="Com IBS/CBS"            value={summary.docsComIBSCBS}    color={C_CREDIT}                 icon={<CheckCircle size={13} color={C_CREDIT} />} />
        <Divider />
        <DocCount label="Sem IBS/CBS (RPA)"      value={summary.docsSemIBSCBS}    color={summary.docsSemIBSCBS > 0 ? C_DEBIT : C_NEUTRAL} icon={summary.docsSemIBSCBS > 0 ? <XCircle size={13} color={C_DEBIT} /> : <CheckCircle size={13} color={C_NEUTRAL} />} />
        <Divider />
        <DocCount label="Simples Nacional / MEI" value={summary.docsSimples}      color={C_NEUTRAL}                icon={null} />
      </div>

      {/* ─── BLOCO 3: GRÁFICO — Créditos e Débitos por CFOP ─── */}
      {cfopData.length > 0 && (
        <Card title="IBS/CBS por CFOP" subtitle="Top CFOPs por volume de impacto tributário (R$)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cfopData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="cfop" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={v => formatBRL(v).replace('R$\u00a0', '')} />
              <Tooltip content={<CfopTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <Bar dataKey="credito" name="Crédito" fill={C_CREDIT} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="debito"  name="Débito"  fill={C_DEBIT}  radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ─── BLOCO 4: CST + Resumo por tipo ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {cstData.length > 0 && (
          <Card title="Distribuição por CST" subtitle="Itens por código de situação tributária">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={cstData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={false}
                  style={{ fontSize: '10px' }}
                >
                  {cstData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="Resumo por Tipo de Documento" subtitle="Volume de IBS/CBS consolidado">
          <table className="data-table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Docs</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {byType.map(row => {
                const saldo = row.credito - row.debito
                return (
                  <tr key={row.tipo}>
                    <td><span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{row.tipo}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)' }}>{row.count}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', color: row.credito > 0 ? C_CREDIT : C_NEUTRAL, fontWeight: row.credito > 0 ? 600 : 400 }}>
                      {row.credito > 0 ? formatBRL(row.credito) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', color: row.debito > 0 ? C_DEBIT : C_NEUTRAL, fontWeight: row.debito > 0 ? 600 : 400 }}>
                      {row.debito > 0 ? formatBRL(row.debito) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', color: saldo >= 0 ? C_CREDIT : C_DEBIT, fontWeight: 600 }}>
                      {formatBRL(Math.abs(saldo))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ─── BLOCO 5: Premissas ─── */}
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
          Premissas desta Apuração
        </p>
        <ul style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingLeft: '16px' }}>
          <li>Documentos anteriores a 01/01/2026 não possuem campos IBS/CBS obrigatórios.</li>
          <li>Crédito integral sobre todo IBS/CBS destacado nas entradas (LC 214/2025).</li>
          <li>CFOPs de remessa, bonificação e exportação são classificados como NEUTROS.</li>
          <li>Emitentes Simples Nacional não destacam IBS/CBS — não geram crédito para o adquirente.</li>
          <li>
            <strong>Índice % de Crédito</strong>: IBS/CBS creditados ÷ total das compras (INBOUND).
            <strong> Índice % de Débito</strong>: IBS/CBS debitados ÷ total das vendas (OUTBOUND).
            <strong> Índice % de Saldo</strong>: saldo líquido ÷ total das vendas (OUTBOUND) — peso real do IBS/CBS sobre cada R$ vendido.
          </li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TOOLTIP CUSTOMIZADO — gráfico de CFOP
// ---------------------------------------------------------------------------

interface TooltipEntry { value: number; name: string; color: string }

function CfopTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '6px', padding: '10px 14px',
      fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
        CFOP {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: '3px 0', color: entry.color }}>
          {entry.name}: {formatBRL(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI FINANCEIRO — card grande com valor + índice percentual
// ---------------------------------------------------------------------------

interface FinancialKpiProps {
  icon:       React.ReactNode
  label:      string
  value:      string
  sub?:       string
  rate:       number
  rateLabel:  string
  rateTitle:  string   // tooltip explicativo
  color:      string
  baseLabel:  string
  baseValue:  string
}

function FinancialKpi({ icon, label, value, sub, rate, rateLabel, rateTitle, color, baseLabel, baseValue }: FinancialKpiProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid var(--color-border)`,
      borderRadius: 'var(--radius-lg)',
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        {icon}
      </div>

      {/* Valor principal */}
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '2rem', fontWeight: 600, color, lineHeight: 1.1, marginTop: '4px' }}>
        {value}
      </p>

      {/* Sub-rótulo (posição credora/devedora) */}
      {sub && (
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color, marginTop: '-2px' }}>{sub}</p>
      )}

      {/* Separador */}
      <div style={{ borderTop: '1px solid var(--color-border)', margin: '8px 0 4px' }} />

      {/* Índice percentual */}
      <div title={rateTitle} style={{ cursor: 'help' }}>
        <p style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontFamily: 'var(--font-data)', fontSize: '1.25rem', fontWeight: 600,
          color, letterSpacing: '-0.01em',
        }}>
          {formatPercent(rate)}
        </p>
        <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
          {rateLabel}
        </p>
      </div>

      {/* Base de cálculo */}
      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
        {baseLabel}: <span style={{ fontFamily: 'var(--font-data)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{baseValue}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CONTADOR DE DOCUMENTOS — compacto, em linha
// ---------------------------------------------------------------------------

function DocCount({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 20px', flex: 1, minWidth: '160px' }}>
      {icon}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '1.35rem', fontWeight: 700, color, lineHeight: 1.2, marginTop: '2px' }}>
          {value.toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: '1px', height: '40px', background: 'var(--color-border)', flexShrink: 0 }} />
}

// ---------------------------------------------------------------------------
// UTILITÁRIO LOCAL
// ---------------------------------------------------------------------------

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}
