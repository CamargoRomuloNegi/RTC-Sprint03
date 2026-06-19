/**
 * @file temporal/page.tsx  (rota "/temporal")
 * @description Análise Temporal — apuração de IBS/CBS agrupada por mês ou trimestre.
 *
 * FUNCIONALIDADES:
 *   - Toggle Mensal / Trimestral
 *   - Gráfico de barras agrupadas (crédito + débito) com linha de saldo (eixo secundário)
 *   - Gráfico de área para saldo acumulado progressivo
 *   - Tabela de períodos com saldo acumulado
 *   - Cards de destaque: melhor período, pior período e tendência
 */
'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Calendar,
} from 'lucide-react'
import { useFiscalStore }          from '@/application/store/useFiscalStore'
import {
  groupByPeriod, getTemporalHighlights,
  type PeriodMode, type PeriodData,
} from '@/application/services/TaxAnalyzerService'
import { EmptyState }  from '@/components/ui/EmptyState'
import { Card }        from '@/components/ui/Card'
import { formatBRL }   from '@/lib/utils'

// ---------------------------------------------------------------------------
// PALETA
// ---------------------------------------------------------------------------
const C_CREDIT  = '#059669'
const C_DEBIT   = '#dc2626'
const C_BALANCE = '#1d4ed8'
const C_ACCUM_POS = '#059669'
const C_ACCUM_NEG = '#dc2626'

// ---------------------------------------------------------------------------
// COMPONENTE
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

  // Filtrar período "sem-data" dos gráficos (mantém na tabela)
  const chartData  = periods.filter(p => p.key !== 'sem-data')
  const finalSaldo = periods[periods.length - 1]?.saldoAcumulado ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Cabeçalho + Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '3px' }}>
            Análise Temporal
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {periods.filter(p => p.key !== 'sem-data').length} {mode === 'monthly' ? 'meses' : 'trimestres'} •{' '}
            {documents.length.toLocaleString('pt-BR')} documentos
            {cnpjRoot && <span> • CNPJ raiz {cnpjRoot}</span>}
          </p>
        </div>

        {/* Toggle mensal/trimestral */}
        <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px' }}>
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
          color={C_CREDIT}
        />
        <HighlightCard
          title="Pior Período"
          period={highlights.worst}
          icon={<TrendingDown size={17} color={C_DEBIT} />}
          color={C_DEBIT}
          invertColor
        />
        <TrendCard highlights={highlights} finalSaldo={finalSaldo} />
      </div>

      {/* ─── GRÁFICO 1: Crédito, Débito e Saldo por período ─── */}
      <Card
        title={`Crédito, Débito e Saldo por ${mode === 'monthly' ? 'Mês' : 'Trimestre'}`}
        subtitle="Barras = IBS/CBS creditado e debitado (R$) • Linha = saldo do período (eixo direito)"
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval={chartData.length > 18 ? Math.floor(chartData.length / 12) : 0}
            />
            {/* Eixo esquerdo: crédito e débito */}
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickFormatter={v => abbrBRL(v)}
              width={64}
            />
            {/* Eixo direito: saldo */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: C_BALANCE }}
              tickFormatter={v => abbrBRL(v)}
              width={64}
            />
            <Tooltip
              formatter={(v, name) => {
                const labels: Record<string, string> = {
                  credito: 'Crédito', debito: 'Débito', saldo: 'Saldo',
                }
                return [formatBRL(Number(v)), labels[String(name)] ?? String(name)]
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
            <Line
              yAxisId="right" dataKey="saldo" name="saldo"
              stroke={C_BALANCE} strokeWidth={2} dot={{ r: 3, fill: C_BALANCE }}
              type="monotone"
            />
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
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickFormatter={v => abbrBRL(v)}
              width={64}
            />
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

      {/* ─── TABELA DE PERÍODOS ─── */}
      <Card
        title={`Detalhe por ${mode === 'monthly' ? 'Mês' : 'Trimestre'}`}
        subtitle="Saldo acumulado = posição progressiva desde o primeiro período"
        noPadding
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th style={{ textAlign: 'right' }}>Documentos</th>
                <th style={{ textAlign: 'right' }}>Com IBS/CBS</th>
                <th style={{ textAlign: 'right' }}>Volume</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'right' }}>Saldo do Período</th>
                <th style={{ textAlign: 'right' }}>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <PeriodRow key={p.key} period={p} />
              ))}
            </tbody>
            {/* Totais */}
            <tfoot>
              <tr style={{ background: 'var(--color-bg)', fontWeight: 700 }}>
                <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>TOTAL</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
                  {periods.reduce((s, p) => s + p.docCount, 0).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: C_CREDIT }}>
                  {periods.reduce((s, p) => s + p.docsComIBS, 0).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
                  {formatBRL(periods.reduce((s, p) => s + p.totalValue, 0))}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: C_CREDIT, fontWeight: 700 }}>
                  {formatBRL(periods.reduce((s, p) => s + p.credito, 0))}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: C_DEBIT, fontWeight: 700 }}>
                  {formatBRL(periods.reduce((s, p) => s + p.debito, 0))}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: finalSaldo >= 0 ? C_CREDIT : C_DEBIT, fontWeight: 700 }}>
                  {formatBRL(Math.abs(finalSaldo))}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: finalSaldo >= 0 ? C_CREDIT : C_DEBIT, fontWeight: 700 }}>
                  {finalSaldo >= 0 ? 'Credor' : 'Devedor'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTES
// ---------------------------------------------------------------------------

function PeriodRow({ period: p }: { period: PeriodData }) {
  const isNoDate  = p.key === 'sem-data'
  const saldoPos  = p.saldo >= 0
  const accumPos  = p.saldoAcumulado >= 0

  return (
    <tr style={{ opacity: isNoDate ? 0.6 : 1 }}>
      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.label}</td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem' }}>
        {p.docCount.toLocaleString('pt-BR')}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: p.docsComIBS > 0 ? C_CREDIT : 'var(--color-text-muted)' }}>
        {p.docsComIBS > 0 ? p.docsComIBS.toLocaleString('pt-BR') : '—'}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
        {formatBRL(p.totalValue)}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: p.credito > 0 ? C_CREDIT : 'var(--color-text-muted)', fontWeight: p.credito > 0 ? 600 : 400 }}>
        {p.credito > 0 ? formatBRL(p.credito) : '—'}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: p.debito > 0 ? C_DEBIT : 'var(--color-text-muted)', fontWeight: p.debito > 0 ? 600 : 400 }}>
        {p.debito > 0 ? formatBRL(p.debito) : '—'}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 600 }}>
        <span style={{ color: saldoPos ? C_CREDIT : C_DEBIT }}>
          {saldoPos ? '+' : '−'}{formatBRL(Math.abs(p.saldo))}
        </span>
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700 }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
          background: accumPos ? 'var(--color-credit-light)' : 'var(--color-debit-light)',
          color: accumPos ? 'var(--color-credit-text)' : 'var(--color-debit-text)',
        }}>
          {accumPos ? '+' : '−'}{formatBRL(Math.abs(p.saldoAcumulado))}
        </span>
      </td>
    </tr>
  )
}

function HighlightCard({
  title, period, icon, color, invertColor,
}: {
  title: string; period: PeriodData | null; icon: React.ReactNode
  color: string; invertColor?: boolean
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

  const saldoColor = invertColor
    ? (period.saldo < 0 ? C_DEBIT : C_CREDIT)
    : (period.saldo >= 0 ? C_CREDIT : C_DEBIT)

  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p className="kpi-label">{title}</p>
        {icon}
      </div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color, marginBottom: '4px' }}>{period.label}</p>
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '1.3rem', fontWeight: 600, color: saldoColor }}>
        {period.saldo >= 0 ? '+' : '−'}{formatBRL(Math.abs(period.saldo))}
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
        {period.docCount} docs • Volume: {formatBRL(period.totalValue)}
      </p>
    </div>
  )
}

function TrendCard({ highlights, finalSaldo }: {
  highlights: ReturnType<typeof getTemporalHighlights>; finalSaldo: number
}) {
  const { trend, trendPct } = highlights
  const accumPos = finalSaldo >= 0

  const trendConfig = {
    up:           { icon: <TrendingUp  size={17} color={C_CREDIT} />, label: 'Tendência de Melhora',   color: C_CREDIT },
    down:         { icon: <TrendingDown size={17} color={C_DEBIT} />, label: 'Tendência de Piora',     color: C_DEBIT  },
    stable:       { icon: <Minus size={17} color="#64748b" />,        label: 'Tendência Estável',      color: '#64748b' },
    insufficient: { icon: <Calendar size={17} color="#64748b" />,     label: 'Períodos Insuficientes', color: '#64748b' },
  }[trend]

  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p className="kpi-label">Posição Final + Tendência</p>
        {trendConfig.icon}
      </div>
      {/* Saldo acumulado final */}
      <p style={{ fontFamily: 'var(--font-data)', fontSize: '1.3rem', fontWeight: 700, color: accumPos ? C_CREDIT : C_DEBIT, marginBottom: '4px' }}>
        {accumPos ? '+' : '−'}{formatBRL(Math.abs(finalSaldo))}
      </p>
      <p style={{ fontSize: '0.75rem', color: accumPos ? 'var(--color-credit-text)' : 'var(--color-debit-text)', fontWeight: 600, marginBottom: '8px' }}>
        {accumPos ? '▲ Posição Credora' : '▼ Posição Devedora'}
      </p>
      {/* Tendência */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: trendConfig.color }}>{trendConfig.label}</p>
        {trend !== 'insufficient' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Últimos 3 períodos vs anteriores: {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UTILITÁRIO — formata valor abreviado para eixos do gráfico
// ---------------------------------------------------------------------------
function abbrBRL(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${abs.toFixed(0)}`
}
