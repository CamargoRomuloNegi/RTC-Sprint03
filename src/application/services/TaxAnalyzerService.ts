/**
 * @file TaxAnalyzerService.ts
 * @description Serviço de enriquecimento e apuração tributária.
 *
 * REGRA CENTRAL (docs/SPEC_BUSINESS_RULES.md — Seção 3 e 4):
 *   O driver de CRÉDITO/DÉBITO é a DIREÇÃO (INBOUND/OUTBOUND).
 *   O CFOP serve APENAS para filtrar operações não-comerciais (→ NEUTRAL).
 *
 * RESPONSABILIDADES:
 *   1. detectMainCnpjRoot  — detecta o CNPJ raiz da empresa analisada por frequência
 *   2. enrichDocument      — classifica direction + rtc_impact por item
 *   3. determineRtcImpact  — aplica a regra crédito/débito/neutro
 *   4. calculateApuracao   — consolida KPIs do período
 */

import type {
  FiscalDocument, DocumentDirection, RtcImpact,
} from '@/domain/models/FiscalDocument'
import { extractCnpjRoot } from '@/lib/utils'

// ---------------------------------------------------------------------------
// TIPOS DE SAÍDA
// ---------------------------------------------------------------------------

export interface ApuracaoSummary {
  totalCreditos:   number
  totalDebitos:    number
  saldo:           number
  docsComIBSCBS:   number
  docsSemIBSCBS:   number
  docsSimples:     number
  totalDocumentos: number
}

export interface CnpjRootDetectionResult {
  cnpjRoot:       string | null
  frequency:      number
  totalDocuments: number
}

// ---------------------------------------------------------------------------
// CFOPs NÃO-COMERCIAIS — geram NEUTRAL independente da direção
// (docs/SPEC_BUSINESS_RULES.md — Seção 5.3)
// ---------------------------------------------------------------------------

/**
 * Prefixos de 4 caracteres (XCXX) que identificam operações não-comerciais.
 * A verificação usa startsWith sobre o CFOP com ponto removido.
 */
const NON_COMMERCIAL_PREFIXES = new Set([
  '5910', '6910', // Remessa p/ bonificação/brinde/amostra
  '5911', '6911', // Remessa p/ demonstração
  '5912', '6912', // Remessa p/ demonstração em processo armazenagem
  '5913', '6913', // Remessa p/ industrialização por conta de terceiros
  '5914', '6914', // Remessa p/ cobertura de vendas
  '5915', '6915', // Remessa p/ zona franca/área de livre comércio (remessa)
  '5916', '6916', // Retorno de mercadoria por conta de terceiros
  '5917', '6917', // Remessa de mercadoria por conta e ordem de terceiros
  '5918', '6918', // Remessa p/ venda fora do estabelecimento
  '5919', '6919', // Retorno de mercadoria não entregue
  '5920', '6920', // Remessa p/ conserto ou reparo
  '5921', '6921', // Retorno de conserto/reparo
  '5922', '6922', // Lançamento por ressarcimento
  '5923', '6923', // Remessa de vasilhame/sacaria
  '5924', '6924', // Retorno de vasilhame/sacaria
  '5925', '6925', // Remessa de talão
  '5949', '6949', // Outras saídas não especificadas
  '5999', '6999', // Outras saídas
  '7101', '7102', '7105', '7107', '7110', '7201', '7202', // Exportações (imunes)
  '7210', '7211', '7212', '7501', '7502', '7503', '7504',
  '7505', '7553', '7649', '7667', '7930', '7949',
])

// ---------------------------------------------------------------------------
// 1. DETECÇÃO DO CNPJ RAIZ
// ---------------------------------------------------------------------------

/**
 * Detecta automaticamente o CNPJ raiz da empresa analisada.
 * Conta aparições de cada CNPJ raiz (8 dígitos) nos campos issuer e receiver.
 * O CNPJ raiz com maior contagem é a empresa analisada.
 */
export function detectMainCnpjRoot(documents: FiscalDocument[]): CnpjRootDetectionResult {
  const freq = new Map<string, number>()

  for (const doc of documents) {
    const roots = [
      extractCnpjRoot(doc.issuer.cnpj_cpf),
      extractCnpjRoot(doc.receiver.cnpj_cpf),
      doc.sender ? extractCnpjRoot(doc.sender.cnpj_cpf) : null,
    ].filter((r): r is string => r !== null && r.length >= 8)

    for (const root of roots) {
      freq.set(root, (freq.get(root) ?? 0) + 1)
    }
  }

  if (freq.size === 0) {
    return { cnpjRoot: null, frequency: 0, totalDocuments: documents.length }
  }

  const [cnpjRoot, frequency] = [...freq.entries()].reduce(
    (best, curr) => curr[1] > best[1] ? curr : best
  )

  return { cnpjRoot, frequency, totalDocuments: documents.length }
}

// ---------------------------------------------------------------------------
// 2. ENRIQUECIMENTO DO DOCUMENTO
// ---------------------------------------------------------------------------

/**
 * Enriquece um documento com direction e rtc_impact por item.
 * Operação imutável — retorna novo objeto sem modificar o original.
 */
export function enrichDocument(doc: FiscalDocument, cnpjRoot: string): FiscalDocument {
  const direction = detectDirection(doc, cnpjRoot)

  const items = doc.items.map((item) => ({
    ...item,
    rtc_impact: determineRtcImpact(item.cfop, direction),
  }))

  return { ...doc, direction, items }
}

/**
 * Detecta a direção do documento em relação à empresa analisada.
 */
function detectDirection(doc: FiscalDocument, cnpjRoot: string): DocumentDirection {
  const issuerRoot   = extractCnpjRoot(doc.issuer.cnpj_cpf)
  const receiverRoot = extractCnpjRoot(doc.receiver.cnpj_cpf)

  if (issuerRoot   === cnpjRoot) return 'OUTBOUND'
  if (receiverRoot === cnpjRoot) return 'INBOUND'
  return 'UNKNOWN'
}

// ---------------------------------------------------------------------------
// 3. IMPACTO RTC POR ITEM
// ---------------------------------------------------------------------------

/**
 * Determina o impacto RTC (CREDIT/DEBIT/NEUTRAL) de um item.
 *
 * Regra:
 *   1. CFOP não-comercial → NEUTRAL
 *   2. INBOUND  → CREDIT  (empresa está recebendo → se credita)
 *   3. OUTBOUND → DEBIT   (empresa está emitindo → gera débito)
 *   4. UNKNOWN  → NEUTRAL
 */
export function determineRtcImpact(cfop: string, direction: DocumentDirection): RtcImpact {
  if (direction === 'UNKNOWN') return 'NEUTRAL'

  // Normalizar CFOP: remover ponto e pegar 4 dígitos
  const normalized = cfop.replace('.', '').slice(0, 4)
  if (NON_COMMERCIAL_PREFIXES.has(normalized)) return 'NEUTRAL'

  if (direction === 'INBOUND')  return 'CREDIT'
  if (direction === 'OUTBOUND') return 'DEBIT'
  return 'NEUTRAL'
}

// ---------------------------------------------------------------------------
// 4. CÁLCULO DA APURAÇÃO
// ---------------------------------------------------------------------------

/**
 * Calcula o sumário consolidado de apuração IBS/CBS de um lote de documentos.
 * Considera apenas documentos já enriquecidos (com direction definida).
 */
export function calculateApuracao(documents: FiscalDocument[]): ApuracaoSummary {
  let totalCreditos = 0
  let totalDebitos  = 0
  let docsComIBSCBS = 0
  let docsSemIBSCBS = 0
  let docsSimples   = 0

  for (const doc of documents) {
    const docVIBS = doc.totals.vIBS ?? 0
    const docVCBS = doc.totals.vCBS ?? 0
    const hasIBSCBS = (docVIBS + docVCBS) > 0

    if (doc.tax_regime === 'SIMPLES_NACIONAL' || doc.tax_regime === 'MEI') {
      docsSimples++
    } else if (hasIBSCBS) {
      docsComIBSCBS++
    } else {
      docsSemIBSCBS++
    }

    for (const item of doc.items) {
      const vIBS = item.rtc.vIBS ?? 0
      const vCBS = item.rtc.vCBS ?? 0
      const total = vIBS + vCBS

      if (total === 0) continue

      if (item.rtc_impact === 'CREDIT') totalCreditos += total
      if (item.rtc_impact === 'DEBIT')  totalDebitos  += total
    }
  }

  return {
    totalCreditos:   round2(totalCreditos),
    totalDebitos:    round2(totalDebitos),
    saldo:           round2(totalCreditos - totalDebitos),
    docsComIBSCBS,
    docsSemIBSCBS,
    docsSimples,
    totalDocumentos: documents.length,
  }
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS INTERNOS
// ---------------------------------------------------------------------------

/** Arredonda para 2 casas decimais evitando erros de ponto flutuante */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Filtra documentos inconformes:
 * RPA + operação comercial + sem IBS/CBS + emitido após 2026-01-01
 */
export function getInconformes(documents: FiscalDocument[]): FiscalDocument[] {
  return documents.filter((doc) => {
    if (doc.tax_regime !== 'RPA') return false
    if (doc.direction !== 'INBOUND') return false

    const issueYear = new Date(doc.issue_date).getFullYear()
    if (issueYear < 2026) return false

    const vIBS = doc.totals.vIBS ?? 0
    const vCBS = doc.totals.vCBS ?? 0
    return (vIBS + vCBS) === 0
  })
}

/**
 * Agrupa documentos por CNPJ do emitente para ranking de fornecedores.
 */
export function groupByCnpjEmitente(
  documents: FiscalDocument[]
): Map<string, { name: string; docs: FiscalDocument[] }> {
  const map = new Map<string, { name: string; docs: FiscalDocument[] }>()

  for (const doc of documents) {
    const key = doc.issuer.cnpj_cpf
    if (!map.has(key)) {
      map.set(key, { name: doc.issuer.name, docs: [] })
    }
    map.get(key)!.docs.push(doc)
  }

  return map
}

// ===========================================================================
// SPRINT 3 — ANÁLISE TEMPORAL
// ===========================================================================

/**
 * Dados consolidados de um período (mês ou trimestre).
 * Inclui saldo acumulado calculado externamente por `groupByPeriod()`.
 */
export interface PeriodData {
  /** Chave de ordenação cronológica: "2026-01" ou "2026-Q1" */
  key:           string
  /** Rótulo de exibição: "Jan/26" ou "1º Tri/26" */
  label:         string
  /** Quantidade de documentos no período */
  docCount:      number
  /** Documentos com IBS/CBS destacado */
  docsComIBS:    number
  /** Volume financeiro total (soma de total_value) */
  totalValue:    number
  /** Volume financeiro de documentos de ENTRADA (INBOUND) — base do índice de crédito */
  inboundValue:  number
  /** Volume financeiro de documentos de SAÍDA (OUTBOUND) — base dos índices de débito e saldo */
  outboundValue: number
  /** IBS/CBS creditados no período */
  credito:       number
  /** IBS/CBS debitados no período */
  debito:        number
  /** Saldo do período = crédito - débito */
  saldo:         number
  /** Saldo acumulado desde o primeiro período */
  saldoAcumulado: number
}

export type PeriodMode = 'monthly' | 'quarterly'

/**
 * Agrupa documentos por período (mensal ou trimestral) e calcula:
 * créditos, débitos, saldo e saldo acumulado progressivo.
 *
 * Documentos sem data válida são agrupados em período "sem-data".
 * O resultado é ordenado cronologicamente (crescente).
 *
 * @param documents  - Lista de documentos enriquecidos pelo TaxAnalyzerService
 * @param mode       - 'monthly' (YYYY-MM) ou 'quarterly' (YYYY-Q#)
 */
export function groupByPeriod(
  documents: FiscalDocument[],
  mode: PeriodMode,
): PeriodData[] {
  const map = new Map<string, Omit<PeriodData, 'saldoAcumulado'>>()

  for (const doc of documents) {
    const key   = buildPeriodKey(doc.issue_date, mode)
    const label = buildPeriodLabel(key, mode)

    const existing = map.get(key) ?? {
      key, label,
      docCount: 0, docsComIBS: 0,
      totalValue: 0, inboundValue: 0, outboundValue: 0,
      credito: 0, debito: 0, saldo: 0,
    }

    existing.docCount++
    existing.totalValue += doc.total_value
    if (doc.direction === 'INBOUND')  existing.inboundValue  += doc.total_value
    if (doc.direction === 'OUTBOUND') existing.outboundValue += doc.total_value

    const docIBS = (doc.totals.vIBS ?? 0) + (doc.totals.vCBS ?? 0)
    if (docIBS > 0) existing.docsComIBS++

    for (const item of doc.items) {
      const v = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
      if (item.rtc_impact === 'CREDIT') existing.credito += v
      else if (item.rtc_impact === 'DEBIT') existing.debito  += v
    }

    existing.saldo = round2(existing.credito - existing.debito)
    map.set(key, existing)
  }

  // Ordenar cronologicamente — "sem-data" vai para o final
  const sorted = Array.from(map.values()).sort((a, b) => {
    if (a.key === 'sem-data') return 1
    if (b.key === 'sem-data') return -1
    return a.key.localeCompare(b.key)
  })

  // Calcular saldo acumulado progressivo
  let accumulated = 0
  return sorted.map(period => {
    accumulated = round2(accumulated + period.saldo)
    return { ...period, saldoAcumulado: accumulated }
  })
}

/**
 * Retorna os três destaques da análise temporal:
 * melhor período, pior período e tendência dos últimos 3 vs anteriores.
 */
export interface TemporalHighlights {
  best:     PeriodData | null   // maior saldo positivo
  worst:    PeriodData | null   // menor saldo (mais devedor)
  trend:    'up' | 'down' | 'stable' | 'insufficient'
  trendPct: number              // variação % entre médias
}

export function getTemporalHighlights(periods: PeriodData[]): TemporalHighlights {
  const valid = periods.filter(p => p.key !== 'sem-data')

  if (valid.length === 0) {
    return { best: null, worst: null, trend: 'insufficient', trendPct: 0 }
  }

  const best  = valid.reduce((a, b) => b.saldo > a.saldo ? b : a)
  const worst = valid.reduce((a, b) => b.saldo < a.saldo ? b : a)

  // Tendência: média dos últimos 3 vs média dos 3 anteriores
  if (valid.length < 4) {
    return { best, worst, trend: 'insufficient', trendPct: 0 }
  }

  const last3 = valid.slice(-3)
  const prev3 = valid.slice(-6, -3)

  const avgLast = last3.reduce((s, p) => s + p.saldo, 0) / last3.length
  const avgPrev = prev3.reduce((s, p) => s + p.saldo, 0) / Math.max(prev3.length, 1)

  const trendPct = avgPrev !== 0
    ? ((avgLast - avgPrev) / Math.abs(avgPrev)) * 100
    : 0

  const trend = Math.abs(trendPct) < 5 ? 'stable'
              : trendPct > 0 ? 'up' : 'down'

  return { best, worst, trend, trendPct: round2(trendPct) }
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS INTERNOS
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function buildPeriodKey(isoDate: string, mode: PeriodMode): string {
  if (!isoDate) return 'sem-data'
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return 'sem-data'
    const year  = d.getFullYear()
    const month = d.getMonth() + 1 // 1–12
    if (mode === 'monthly') {
      return `${year}-${String(month).padStart(2, '0')}`
    }
    const quarter = Math.ceil(month / 3)
    return `${year}-Q${quarter}`
  } catch { return 'sem-data' }
}

function buildPeriodLabel(key: string, mode: PeriodMode): string {
  if (key === 'sem-data') return 'Sem data'
  try {
    if (mode === 'monthly') {
      const [year, month] = key.split('-')
      const m = parseInt(month ?? '1') - 1
      return `${MONTH_NAMES[m] ?? month}/${String(year).slice(2)}`
    }
    // quarterly: "2026-Q1" → "1º Tri/26"
    const [year, q] = key.split('-Q')
    const ordinals: Record<string, string> = { '1':'1º','2':'2º','3':'3º','4':'4º' }
    return `${ordinals[q ?? '1'] ?? q}° Tri/${String(year).slice(2)}`
  } catch { return key }
}
