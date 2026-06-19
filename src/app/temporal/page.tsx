/**
 * @file temporal/page.tsx  (rota "/temporal")
 * @description Análise Temporal — apuração de IBS/CBS agrupada por mês ou trimestre.
 *
 * ÍNDICES PERCENTUAIS (consistentes com a tela de Apuração RTC):
 *   Índice Crédito  = IBS/CBS creditados  ÷ volume total das entradas (INBOUND) do período
 *   Índice Débito   = IBS/CBS debitados   ÷ volume total das saídas  (OUTBOUND) do período
 *   Índice Saldo    = saldo líquido        ÷ volume total das saídas  (OUTBOUND) do período
 *
 * Raciocínio: "para cada R$ de saída, qual o peso líquido do IBS/CBS?"
 */
'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react'
import { useFiscalStore }        from '@/application/store/useFiscalStore'
import {
  groupByPeriod, getTemporalHighlights,
  type PeriodMode, type PeriodData,
} from '@/application/services/TaxAnalyzerService'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card }       from '@/components/ui/Card'
import { formatBRL }  from '@/lib/utils'

// ---------------------------------------------------------------------------
// PALETA
// ---------------------------------------------------------------------------
const C_CREDIT    = '#059669'
const C_DEBIT     = '#dc2626'
const C_BALANCE   = '#1d4ed8'
const C_ACCUM_POS = '#059669'
const C_ACCUM_NEG = '#dc2626'

// ---------------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------------

function fmtPct(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

/** IBS/CBS creditados ÷ volume INBOUND do período */
function creditRate(p: PeriodData): number {
  return p.inboundValue > 0 ? (p.credito / p.inboundValue) * 100 : 0
}

/** IBS/CBS debitados ÷ volume OUTBOUND do período */
function debitRate(p: PeriodData): number {
  return p.outboundValue > 0 ? (p.debito / p.outboundValue) * 100 : 0
}

/** Saldo líquido ÷ volume OUTBOUND do período — peso real do IBS/CBS sobre cada R$ vendido */
function balanceRate(p: PeriodData): number {
  return p.outboundValue > 0 ? (p.saldo / p.outboundValue) * 100 : 0
}

function abbrBRL(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${abs.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export default function TemporalPage() {
  const documents = useFiscalStore(s => s.documents)
  const cnpjRoot  = useFiscalStore(s => s.analyzedCnpjRoot)
  const [mode, setMode] = useState<PeriodMode>('monthly')

  const periods    = useMemo(() => groupByPeriod(documents, mode), [documents, mode])
  const highlights = useMemo(() => getTemporalHighlights(periods),  [periods])

  if (documents.length === 0) {
    return (
      <EmptyState
        variant="upload"
        title="Nenhum documento carregado"
        description="Carregue XMLs fiscais para visualizar a evolução temporal da apuração RTC."
      />
    )
  }

  if (periods.length === 0 || (periods.length === 1 && periods[0]?.key === 'sem-data')) {
    return (
      <EmptyState
        variant="warning"
        title="Sem dados temporais"
        description="Os documentos carregados não possuem datas válidas para agrupamento por período."
      />
    )
  }

  const chartData  = periods.filter(p => p.key !== 'sem-data')
  const lastPeriod = periods[periods.length - 1]
  const finalSaldo = lastPeriod?.saldoAcumulado ?? 0

  // Totais consolidados para rodapé da tabela
  const totCredito  = periods.reduce((s, p) => s + p.credito,       0)
  const totDebito   = periods.reduce((s, p) => s + p.debito,        0)
  const totInbound  = periods.reduce((s, p) => s + p.inboundValue,  0)
  const totOutbound = periods.reduce((s, p) => s + p.outboundValue, 0)
  // totSaldo e totDocs calculados abaixo
  const totSaldo    = totCredito - totDebito
  const totDocs     = periods.reduce((s, p) => s + p.docCount,      0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Cabeçalho + Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '3px' }}>
            Análise Temporal
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {chartData.length} {mode === 'monthly' ? 'meses' : 'trimestres'} •{' '}
            {documents.length.toLocaleString('pt-BR')} documentos
            {cnpjRoot && <span> • CNPJ raiz {cnpjRoot}</span>}
          </p>
        </div>

        {/* Toggle mensal / trimestral */}
        <div style={{
          display: 'flex', background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px',
        }}>
          {(['monthly', 'quarterly'] as PeriodMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 16px', borderRadius: '7px', border: 'none',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
                fontFamily: 'var(--font-ui)',
                background: mode === m ? 'var(--color-surface)' : 'transparent',
                color:      mode === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow:  mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'monthly' ? 'Mensal' : 'Trimestral'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── DESTAQUES ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <HighlightCard
          title="Melhor Período"
          period={highlights.best}
          icon={<TrendingUp size={17} color={C_CREDIT} />}
          labelColor={C_CREDIT}
        />
        <HighlightCard
          title="Pior Período"
          period={highlights.worst}
          icon={<TrendingDown size={17} color={C_DEBIT} />}
          labelColor={C_DEBIT}
          invertSign
        />
        <TrendCard highlights={highlights} finalSaldo={finalSaldo} />
      </div>

      {/* ─── GRÁFICO 1: Crédito, Débito e Saldo por período ─── */}
      <Card
        title={`Crédito, Débito e Saldo — por ${mode === 'monthly' ? 'Mês' : 'Trimestre'}`}
        subtitle="Barras = volume IBS/CBS (R$) • Linha = saldo do período (eixo direito)"
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval={chartData.length > 18 ? Math.floor(chartData.length / 12) : 0}
            />
            <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={v => abbrBRL(v)} width={64} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: C_BALANCE }} tickFormatter={v => abbrBRL(v)} width={64} />
            <Tooltip
              formatter={(v, name) => {
                const labels: Record<string, string> = { credito: 'Crédito', debito: 'Débito', saldo: 'Saldo' }
                return [formatBRL(Number(v)), (labels as Record<string, string>)[String(name)] ?? String(name)]
              }}
              contentStyle={{ fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: '6px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.8rem' }}
              formatter={(v: string) => ({ credito: 'Crédito', debito: 'Débito', saldo: 'Saldo' } as Record<string, string>)[v] ?? v}
            />
            <ReferenceLine yAxisId="right" y={0} stroke={C_BALANCE} strokeDasharray="4 2" strokeOpacity={0.4} />
            <Bar yAxisId="left" dataKey="credito" name="credito" fill={C_CREDIT} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="left" dataKey="debito"  name="debito"  fill={C_DEBIT}  radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line yAxisId="right" dataKey="saldo" name="saldo" stroke={C_BALANCE} strokeWidth={2} dot={{ r: 3, fill: C_BALANCE }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ─── GRÁFICO 2: Saldo Acumulado ─── */}
      <Card
        title="Posição Acumulada (Saldo Progressivo)"
        subtitle="Acúmulo do saldo IBS/CBS ao longo dos períodos — acima da linha = posição credora"
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
            <defs>
              <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C_ACCUM_POS} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C_ACCUM_POS} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C_ACCUM_NEG} stopOpacity={0.02} />
                <stop offset="95%" stopColor={C_ACCUM_NEG} stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval={chartData.length > 18 ? Math.floor(chartData.length / 12) : 0}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={v => abbrBRL(v)} width={64} />
            <Tooltip
              formatter={(v) => [formatBRL(Number(v)), 'Saldo Acumulado']}
              contentStyle={{ fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: '6px' }}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 2" label={{ value: 'Zero', fontSize: 10, fill: '#64748b' }} />
            <Area
              type="monotone"
              dataKey="saldoAcumulado"
              stroke={finalSaldo >= 0 ? C_ACCUM_POS : C_ACCUM_NEG}
              strokeWidth={2}
              fill={finalSaldo >= 0 ? 'url(#gradPos)' : 'url(#gradNeg)'}
              dot={{ r: 2, fill: finalSaldo >= 0 ? C_ACCUM_POS : C_ACCUM_NEG }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* ─── TABELA DE PERÍODOS COM ÍNDICES ─── */}
      <Card
        title={`Detalhe por ${mode === 'monthly' ? 'Mês' : 'Trimestre'} — com Índices %`}
        subtitle="Índice Crédito = IBS/CBS crédito ÷ entradas • Índice Débito e Saldo = IBS/CBS ÷ saídas"
        noPadding
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th style={{ textAlign: 'right' }}>Docs</th>
                <th style={{ textAlign: 'right' }}>Entradas</th>
                <th style={{ textAlign: 'right' }}>Saídas</th>
                <th style={{ textAlign: 'right' }}>
                  Crédito IBS/CBS
                  <div style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    % das entradas
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>
                  Débito IBS/CBS
                  <div style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    % das saídas
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>
                  Saldo
                  <div style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    % das saídas
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => <PeriodRow key={p.key} period={p} />)}
            </tbody>

            {/* Totais consolidados */}
            <tfoot>
              <tr style={{ background: 'var(--color-bg)' }}>
                <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700 }}>
                  {totDocs.toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
                  {formatBRL(totInbound)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
                  {formatBRL(totOutbound)}
                </td>
                <TotalPctCell value={totCredito} base={totInbound} color={C_CREDIT} />
                <TotalPctCell value={totDebito}  base={totOutbound} color={C_DEBIT} />
                <TotalPctCell value={totSaldo}   base={totOutbound} color={totSaldo >= 0 ? C_CREDIT : C_DEBIT} signed />
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700, color: finalSaldo >= 0 ? C_CREDIT : C_DEBIT }}>
                  {finalSaldo >= 0 ? 'Credor' : 'Devedor'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legenda dos índices */}
        <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <strong>Índice Crédito %</strong>: IBS/CBS creditado ÷ total das entradas do período &nbsp;•&nbsp;
            <strong>Índice Débito %</strong>: IBS/CBS debitado ÷ total das saídas &nbsp;•&nbsp;
            <strong>Índice Saldo %</strong>: saldo líquido ÷ total das saídas — para cada R$ vendido, qual o peso líquido do IBS/CBS
          </p>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LINHA DA TABELA
// ---------------------------------------------------------------------------

function PeriodRow({ period: p }: { period: PeriodData }) {
  const isNoDate = p.key === 'sem-data'
  const saldoPos = p.saldo >= 0
  const accumPos = p.saldoAcumulado >= 0
  const cr = creditRate(p)
  const dr = debitRate(p)
  const br = balanceRate(p)

  return (
    <tr style={{ opacity: isNoDate ? 0.6 : 1 }}>
      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.label}</td>

      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
        {p.docCount.toLocaleString('pt-BR')}
        {p.docsComIBS > 0 && (
          <div style={{ fontSize: '0.68rem', color: C_CREDIT }}>
            {p.docsComIBS} c/ IBS
          </div>
        )}
      </td>

      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
        {p.inboundValue > 0 ? formatBRL(p.inboundValue) : '—'}
      </td>

      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
        {p.outboundValue > 0 ? formatBRL(p.outboundValue) : '—'}
      </td>

      {/* Crédito + índice */}
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
        {p.credito > 0 ? (
          <>
            <span style={{ color: C_CREDIT, fontWeight: 600 }}>{formatBRL(p.credito)}</span>
            <div style={{ fontSize: '0.72rem', color: C_CREDIT, opacity: 0.8 }}>{fmtPct(cr)}</div>
          </>
        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
      </td>

      {/* Débito + índice */}
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
        {p.debito > 0 ? (
          <>
            <span style={{ color: C_DEBIT, fontWeight: 600 }}>{formatBRL(p.debito)}</span>
            <div style={{ fontSize: '0.72rem', color: C_DEBIT, opacity: 0.8 }}>{fmtPct(dr)}</div>
          </>
        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
      </td>

      {/* Saldo do período + índice */}
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
        <span style={{ color: saldoPos ? C_CREDIT : C_DEBIT, fontWeight: 600 }}>
          {saldoPos ? '+' : '−'}{formatBRL(Math.abs(p.saldo))}
        </span>
        {p.outboundValue > 0 && (
          <div style={{ fontSize: '0.72rem', color: saldoPos ? C_CREDIT : C_DEBIT, opacity: 0.8 }}>
            {br >= 0 ? '+' : ''}{fmtPct(br)}
          </div>
        )}
      </td>

      {/* Saldo acumulado */}
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700 }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
          background: accumPos ? 'var(--color-credit-light)' : 'var(--color-debit-light)',
          color:      accumPos ? 'var(--color-credit-text)'  : 'var(--color-debit-text)',
        }}>
          {accumPos ? '+' : '−'}{formatBRL(Math.abs(p.saldoAcumulado))}
        </span>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// CÉLULAS DE TOTAL NO RODAPÉ
// ---------------------------------------------------------------------------

function TotalPctCell({ value, base, color, signed }: {
  value: number; base: number; color: string; signed?: boolean
}) {
  const pct = base > 0 ? (value / base) * 100 : 0
  return (
    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
      <span style={{ color, fontWeight: 700 }}>
        {signed && value >= 0 ? '+' : signed && value < 0 ? '−' : ''}
        {formatBRL(Math.abs(value))}
      </span>
      {base > 0 && (
        <div style={{ fontSize: '0.72rem', color, opacity: 0.8, fontWeight: 600 }}>
          {signed && pct >= 0 ? '+' : ''}{fmtPct(pct)}
        </div>
      )}
    </td>
  )
}

// ---------------------------------------------------------------------------
// CARDS DE DESTAQUE
// ---------------------------------------------------------------------------

function HighlightCard({
  title, period, icon, labelColor, invertSign,
}: {
  title: string; period: PeriodData | null; icon: React.ReactNode
  labelColor: string; invertSign?: boolean
}) {
  if (!period) {
    return (
      <div className="kpi-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p className="kpi-label">{title}</p>
          {icon}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Dados insuficientes</p>
      </div>
    )
  }

  const saldoColor = invertSign
    ? (period.saldo <= 0 ? C_DEBIT  : C_CREDIT)
    : (period.saldo >= 0 ? C_CREDIT : C_DEBIT)

  const br = balanceRate(period)

  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p className="kpi-label">{title}</p>
        {icon}
      </div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: labelColor, marginBottom: '4px' }}>{period.label}</p>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '1.3rem', fontWeight: 600, color: saldoColor }}>
        {period.saldo >= 0 ? '+' : '−'}{formatBRL(Math.abs(period.saldo))}
      </p>
      {period.outboundValue > 0 && (
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: saldoColor, opacity: 0.85, marginTop: '2px' }}>
          {br >= 0 ? '+' : ''}{fmtPct(br)} das saídas
        </p>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
        {period.docCount} docs • Saídas: {formatBRL(period.outboundValue)}
      </p>
    </div>
  )
}

function TrendCard({ highlights, finalSaldo }: {
  highlights: ReturnType<typeof getTemporalHighlights>; finalSaldo: number
}) {
  const { trend, trendPct } = highlights
  const accumPos = finalSaldo >= 0

  const cfg = {
    up:           { icon: <TrendingUp  size={17} color={C_CREDIT} />, label: 'Tendência de Melhora',   color: C_CREDIT },
    down:         { icon: <TrendingDown size={17} color={C_DEBIT} />, label: 'Tendência de Piora',     color: C_DEBIT  },
    stable:       { icon: <Minus size={17} color="#64748b" />,        label: 'Tendência Estável',      color: '#64748b' },
    insufficient: { icon: <Calendar size={17} color="#64748b" />,     label: 'Períodos Insuficientes', color: '#64748b' },
  }[trend]

  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p className="kpi-label">Posição Final + Tendência</p>
        {cfg.icon}
      </div>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '1.3rem', fontWeight: 700, color: accumPos ? C_CREDIT : C_DEBIT, marginBottom: '4px' }}>
        {accumPos ? '+' : '−'}{formatBRL(Math.abs(finalSaldo))}
      </p>
      <p style={{ fontSize: '0.75rem', color: accumPos ? 'var(--color-credit-text)' : 'var(--color-debit-text)', fontWeight: 600, marginBottom: '8px' }}>
        {accumPos ? '▲ Posição Credora' : '▼ Posição Devedora'}
      </p>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</p>
        {trend !== 'insufficient' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Últimos 3 vs anteriores: {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  )
}
