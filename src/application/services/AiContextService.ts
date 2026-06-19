/**
 * @file AiContextService.ts
 * @description Constrói o AiContext a partir dos documentos fiscais carregados.
 *
 * GUARDIÃO DE PRIVACIDADE:
 *   Esta função é a fronteira entre dados fiscais e o que vai para a IA.
 *   Ela NUNCA inclui no contexto:
 *     - CNPJs individuais
 *     - Nomes de empresas ou pessoas
 *     - Chaves de acesso de documentos
 *     - Endereços ou qualquer dado pessoal
 *
 *   Apenas estatísticas AGREGADAS são permitidas.
 *   Qualquer alteração que adicione dados individuais deve ser revisada.
 *
 * DESIGN: função pura — recebe documentos, retorna AiContext.
 * Sem acoplamento ao store Zustand — totalmente testável.
 */

import type { FiscalDocument }  from '@/domain/models/FiscalDocument'
import type { AiContext }        from '@/domain/models/AiTypes'
import { groupByPeriod }         from './TaxAnalyzerService'

// ---------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Constrói o contexto que será enviado ao Gemini.
 * Recebe documentos já enriquecidos (com direction e rtc_impact).
 */
export function buildAiContext(documents: FiscalDocument[]): AiContext {
  if (documents.length === 0) {
    return emptyContext()
  }

  // --- Volumes por direção ---
  let inbound = 0, outbound = 0
  for (const doc of documents) {
    if (doc.direction === 'INBOUND')  inbound  += doc.total_value
    if (doc.direction === 'OUTBOUND') outbound += doc.total_value
  }
  const total = inbound + outbound

  // --- IBS/CBS ---
  let credito = 0, debito = 0
  for (const doc of documents) {
    for (const item of doc.items) {
      const v = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
      if (item.rtc_impact === 'CREDIT') credito += v
      if (item.rtc_impact === 'DEBIT')  debito  += v
    }
  }
  const saldo = credito - debito

  // --- Regime ---
  const byRegime = { rpa: 0, simples: 0, mei: 0 }
  for (const doc of documents) {
    if (doc.tax_regime === 'RPA')              byRegime.rpa++
    if (doc.tax_regime === 'SIMPLES_NACIONAL') byRegime.simples++
    if (doc.tax_regime === 'MEI')              byRegime.mei++
  }

  // --- Por tipo de documento (sem dados individuais) ---
  const typeMap = new Map<string, { count: number; credito: number; debito: number }>()
  for (const doc of documents) {
    const key = doc.document_type
    const ex  = typeMap.get(key) ?? { count: 0, credito: 0, debito: 0 }
    ex.count++
    for (const item of doc.items) {
      const v = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
      if (item.rtc_impact === 'CREDIT') ex.credito += v
      if (item.rtc_impact === 'DEBIT')  ex.debito  += v
    }
    typeMap.set(key, ex)
  }

  // --- Top CFOPs (dados públicos SEFAZ) ---
  const cfopMap = new Map<string, { credito: number; debito: number }>()
  for (const doc of documents) {
    for (const item of doc.items) {
      const key = item.cfop || 'N/A'
      const ex  = cfopMap.get(key) ?? { credito: 0, debito: 0 }
      const v   = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
      if (item.rtc_impact === 'CREDIT') ex.credito += v
      if (item.rtc_impact === 'DEBIT')  ex.debito  += v
      cfopMap.set(key, ex)
    }
  }
  const topCfops = Array.from(cfopMap.entries())
    .map(([cfop, v]) => ({ cfop, ...v }))
    .filter(c => c.credito > 0 || c.debito > 0)
    .sort((a, b) => (b.credito + b.debito) - (a.credito + a.debito))
    .slice(0, 8)

  // --- Inconformidades ---
  const inconformes = documents.filter(doc =>
    doc.tax_regime === 'RPA' &&
    doc.direction  === 'INBOUND' &&
    new Date(doc.issue_date).getFullYear() >= 2026 &&
    (doc.totals.vIBS ?? 0) + (doc.totals.vCBS ?? 0) === 0
  ).length

  // --- Período (datas mínima e máxima — sem identificação de empresa) ---
  const period = extractPeriod(documents)

  // --- Resumo temporal mensal (max 12 meses) ---
  const temporalData = groupByPeriod(documents, 'monthly')
    .filter(p => p.key !== 'sem-data')
    .slice(-12)
    .map(p => ({ label: p.label, credito: p.credito, debito: p.debito, saldo: p.saldo }))

  return {
    period,
    totalDocs: documents.length,
    volumes: {
      inbound:  round2(inbound),
      outbound: round2(outbound),
      total:    round2(total),
    },
    ibscbs: {
      credito:     round2(credito),
      debito:      round2(debito),
      saldo:       round2(saldo),
      creditRate:  inbound  > 0 ? round2((credito / inbound)  * 100) : 0,
      debitRate:   outbound > 0 ? round2((debito  / outbound) * 100) : 0,
      balanceRate: outbound > 0 ? round2((saldo   / outbound) * 100) : 0,
    },
    byDocType: Array.from(typeMap.entries()).map(([tipo, v]) => ({ tipo, ...v })),
    byRegime,
    inconformes,
    topCfops,
    temporal: temporalData,
  }
}

// ---------------------------------------------------------------------------
// VERIFICAÇÃO DE PRIVACIDADE (uso em testes)
// ---------------------------------------------------------------------------

/**
 * Verifica se o contexto contém dados que não deveriam ser enviados.
 * Retorna lista de violações (vazia se seguro).
 */
export function auditContextPrivacy(
  context: AiContext,
  documents: FiscalDocument[],
): string[] {
  const violations: string[] = []
  const contextStr = JSON.stringify(context)

  // Verificar se algum CNPJ individual aparece no contexto
  for (const doc of documents) {
    const cnpj = doc.issuer.cnpj_cpf.replace(/\D/g, '')
    if (cnpj.length >= 8 && contextStr.includes(cnpj)) {
      violations.push(`CNPJ encontrado no contexto: ${cnpj.slice(0, 4)}****`)
    }
    // Verificar nome do emitente
    const name = doc.issuer.name
    if (name && name.length > 4 && contextStr.includes(name)) {
      violations.push(`Nome de empresa encontrado: ${name.slice(0, 8)}...`)
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------------

function emptyContext(): AiContext {
  return {
    period:    'Sem documentos',
    totalDocs: 0,
    volumes:   { inbound: 0, outbound: 0, total: 0 },
    ibscbs:    { credito: 0, debito: 0, saldo: 0, creditRate: 0, debitRate: 0, balanceRate: 0 },
    byDocType: [],
    byRegime:  { rpa: 0, simples: 0, mei: 0 },
    inconformes: 0,
    topCfops:  [],
    temporal:  [],
  }
}

function extractPeriod(documents: FiscalDocument[]): string {
  const dates = documents
    .map(d => d.issue_date)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length === 0) return 'Período não identificado'

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  const first = dates[0]!
  const last  = dates[dates.length - 1]!

  return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
    ? fmt(first)
    : `${fmt(first)} – ${fmt(last)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
