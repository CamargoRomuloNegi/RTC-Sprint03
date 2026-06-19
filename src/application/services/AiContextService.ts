/**
 * @file AiContextService.ts
 * @description Constrói o AiContext a partir dos documentos fiscais carregados.
 *
 * GUARDIÃO DE PRIVACIDADE:
 *   Esta função NUNCA inclui no contexto:
 *     - CNPJs individuais
 *     - Nomes de empresas ou pessoas
 *     - Chaves de acesso de documentos
 *   Apenas estatísticas AGREGADAS são permitidas.
 *
 * ANÁLISE DE REGIME (Sprint 4 v4):
 *   Detecta automaticamente:
 *   1. Regime da empresa analisada (OUTBOUND = ela é emitente → CRT dela)
 *   2. Perfil de compras (INBOUND): fornecedores RPA com IBS/CBS vs. Simples sem
 *   3. Perfil de vendas (OUTBOUND): B2B (CNPJ) vs. B2C (CPF/consumidor anônimo)
 *
 * DESIGN: função pura — recebe documentos, retorna AiContext. Testável.
 */

import type { FiscalDocument, TaxRegime } from '@/domain/models/FiscalDocument'
import type { AiContext }                  from '@/domain/models/AiTypes'
import { groupByPeriod }                   from './TaxAnalyzerService'

// ---------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// ---------------------------------------------------------------------------

export function buildAiContext(documents: FiscalDocument[]): AiContext {
  if (documents.length === 0) return emptyContext()

  // ── Volumes por direção ──────────────────────────────────────────────────
  let inbound = 0, outbound = 0
  for (const doc of documents) {
    if (doc.direction === 'INBOUND')  inbound  += doc.total_value
    if (doc.direction === 'OUTBOUND') outbound += doc.total_value
  }

  // ── IBS/CBS ──────────────────────────────────────────────────────────────
  let credito = 0, debito = 0
  for (const doc of documents) {
    for (const item of doc.items) {
      const v = (item.rtc.vIBS ?? 0) + (item.rtc.vCBS ?? 0)
      if (item.rtc_impact === 'CREDIT') credito += v
      if (item.rtc_impact === 'DEBIT')  debito  += v
    }
  }
  const saldo = credito - debito

  // ── Regime dos emitentes nos docs INBOUND (fornecedores) ─────────────────
  const byRegime = { rpa: 0, simples: 0, mei: 0 }
  for (const doc of documents) {
    if (doc.tax_regime === 'RPA')              byRegime.rpa++
    if (doc.tax_regime === 'SIMPLES_NACIONAL') byRegime.simples++
    if (doc.tax_regime === 'MEI')              byRegime.mei++
  }

  // ── Regime da empresa ANALISADA ──────────────────────────────────────────
  // Detectado nos documentos OUTBOUND (empresa = emitente → CRT é dela)
  const companyRegime = detectCompanyRegime(documents)

  // ── Perfil de compras (docs INBOUND) ────────────────────────────────────
  const purchaseProfile = buildPurchaseProfile(documents)

  // ── Perfil de vendas (docs OUTBOUND) ────────────────────────────────────
  const salesProfile = buildSalesProfile(documents)

  // ── Por tipo de documento ────────────────────────────────────────────────
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

  // ── Top CFOPs ────────────────────────────────────────────────────────────
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

  // ── Inconformidades ──────────────────────────────────────────────────────
  const inconformes = documents.filter(doc =>
    doc.tax_regime === 'RPA' &&
    doc.direction  === 'INBOUND' &&
    new Date(doc.issue_date).getFullYear() >= 2026 &&
    (doc.totals.vIBS ?? 0) + (doc.totals.vCBS ?? 0) === 0
  ).length

  // ── Período ──────────────────────────────────────────────────────────────
  const period = extractPeriod(documents)

  // ── Resumo temporal ──────────────────────────────────────────────────────
  const temporal = groupByPeriod(documents, 'monthly')
    .filter(p => p.key !== 'sem-data')
    .slice(-12)
    .map(p => ({ label: p.label, credito: p.credito, debito: p.debito, saldo: p.saldo }))

  return {
    period,
    totalDocs: documents.length,
    volumes: {
      inbound:  round2(inbound),
      outbound: round2(outbound),
      total:    round2(inbound + outbound),
    },
    ibscbs: {
      credito:     round2(credito),
      debito:      round2(debito),
      saldo:       round2(saldo),
      creditRate:  inbound  > 0 ? round2((credito / inbound)  * 100) : 0,
      debitRate:   outbound > 0 ? round2((debito  / outbound) * 100) : 0,
      balanceRate: outbound > 0 ? round2((saldo   / outbound) * 100) : 0,
    },
    byDocType:       Array.from(typeMap.entries()).map(([tipo, v]) => ({ tipo, ...v })),
    byRegime,
    inconformes,
    topCfops,
    temporal,
    companyRegime,
    purchaseProfile,
    salesProfile,
  }
}

// ---------------------------------------------------------------------------
// DETECÇÃO DO REGIME DA EMPRESA ANALISADA
// ---------------------------------------------------------------------------

/**
 * Detecta o regime da empresa analisada olhando os docs OUTBOUND
 * (onde ela é emitente — o CRT é o dela).
 * Se não houver OUTBOUND, infere pelos INBOUND com lógica inversa.
 */
function detectCompanyRegime(documents: FiscalDocument[]): AiContext['companyRegime'] {
  const outbound = documents.filter(d => d.direction === 'OUTBOUND')
  if (outbound.length === 0) return 'UNKNOWN'

  let rpa = 0, simples = 0, mei = 0
  for (const doc of outbound) {
    if (doc.tax_regime === 'RPA')              rpa++
    if (doc.tax_regime === 'SIMPLES_NACIONAL') simples++
    if (doc.tax_regime === 'MEI')              mei++
  }

  if (rpa === 0 && simples === 0 && mei === 0) return 'UNKNOWN'
  if (rpa >= simples && rpa >= mei)              return 'RPA'
  if (simples >= rpa  && simples >= mei)         return 'SIMPLES_NACIONAL'
  return 'MEI'
}

// ---------------------------------------------------------------------------
// PERFIL DE COMPRAS
// ---------------------------------------------------------------------------

/**
 * Analisa os docs INBOUND para entender quantos fornecedores têm IBS/CBS.
 * - withCredits: fornecedores RPA que destacam IBS/CBS (aproveitável)
 * - neutral:     fornecedores Simples/MEI sem IBS/CBS (não gera crédito)
 */
function buildPurchaseProfile(documents: FiscalDocument[]): AiContext['purchaseProfile'] {
  const inbound = documents.filter(d => d.direction === 'INBOUND')
  if (inbound.length === 0) {
    return { withCredits: 0, neutral: 0, creditCoverageRate: 0 }
  }

  let withCredits     = 0
  let neutral         = 0
  let valueWithCred   = 0
  let valueTotalInb   = 0

  for (const doc of inbound) {
    const hasIbs = (doc.totals.vIBS ?? 0) + (doc.totals.vCBS ?? 0) > 0
    valueTotalInb += doc.total_value
    if (hasIbs) {
      withCredits++
      valueWithCred += doc.total_value
    } else {
      neutral++
    }
  }

  return {
    withCredits,
    neutral,
    creditCoverageRate: valueTotalInb > 0
      ? round2((valueWithCred / valueTotalInb) * 100)
      : 0,
  }
}

// ---------------------------------------------------------------------------
// PERFIL DE VENDAS
// ---------------------------------------------------------------------------

/**
 * Analisa os docs OUTBOUND para identificar B2B vs B2C.
 * B2B: receiver é CNPJ (14 dígitos) — empresa que pode querer crédito
 * B2C: receiver é CPF, 'CONSUMIDOR_FINAL' ou anônimo — não aplica crédito
 */
function buildSalesProfile(documents: FiscalDocument[]): AiContext['salesProfile'] {
  const outbound = documents.filter(d => d.direction === 'OUTBOUND')
  if (outbound.length === 0) {
    return { b2b: 0, b2c: 0, b2bRate: 0 }
  }

  let b2b = 0, b2c = 0
  for (const doc of outbound) {
    const rcv   = doc.receiver.cnpj_cpf.replace(/\D/g, '')
    const isCnpj = rcv.length === 14
    if (isCnpj) b2b++
    else        b2c++ // CPF (11 dígitos) ou CONSUMIDOR_FINAL
  }

  return {
    b2b,
    b2c,
    b2bRate: round2((b2b / outbound.length) * 100),
  }
}

// ---------------------------------------------------------------------------
// VERIFICAÇÃO DE PRIVACIDADE (uso em testes)
// ---------------------------------------------------------------------------

export function auditContextPrivacy(
  context: AiContext,
  documents: FiscalDocument[],
): string[] {
  const violations: string[] = []
  const contextStr = JSON.stringify(context)

  for (const doc of documents) {
    const cnpj = doc.issuer.cnpj_cpf.replace(/\D/g, '')
    if (cnpj.length >= 8 && contextStr.includes(cnpj)) {
      violations.push(`CNPJ encontrado: ${cnpj.slice(0, 4)}****`)
    }
    const name = doc.issuer.name
    if (name && name.length > 4 && name !== 'EMPRESA ANONIMA LTDA' && contextStr.includes(name)) {
      violations.push(`Nome encontrado: ${name.slice(0, 8)}…`)
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
    inconformes:     0,
    topCfops:        [],
    temporal:        [],
    companyRegime:   'UNKNOWN',
    purchaseProfile: { withCredits: 0, neutral: 0, creditCoverageRate: 0 },
    salesProfile:    { b2b: 0, b2c: 0, b2bRate: 0 },
  }
}

function extractPeriod(documents: FiscalDocument[]): string {
  const dates = documents
    .map(d => d.issue_date).filter(Boolean)
    .map(d => new Date(d)).filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (dates.length === 0) return 'Período não identificado'
  const fmt   = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  const first = dates[0]!
  const last  = dates[dates.length - 1]!
  return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
    ? fmt(first)
    : `${fmt(first)} – ${fmt(last)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
