/**
 * @file AiContextService.test.ts
 * @description Testes da fronteira de privacidade do módulo de IA.
 *
 * FOCO: garantir que o AiContext NUNCA vaze dados individuais.
 * A correção matemática dos agregados é verificada secundariamente.
 */
import { describe, it, expect } from 'vitest'
import { buildAiContext, auditContextPrivacy } from '@/application/services/AiContextService'
import type { FiscalDocument } from '@/domain/models/FiscalDocument'

// ---------------------------------------------------------------------------
// FÁBRICA DE DOCUMENTOS
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<FiscalDocument> = {}): FiscalDocument {
  return {
    access_key:      '35260500000000000000550010000000011000000001',
    document_type:   'NFE',
    version:         '4.00',
    issue_date:      '2026-01-15T10:00:00-03:00',
    purpose:         'NORMAL',
    tax_regime:      'RPA',
    direction:       'INBOUND',
    issuer:   { cnpj_cpf: '12345678000100', name: 'EMPRESA FORNECEDORA LTDA' },
    receiver: { cnpj_cpf: '98765432000100', name: 'EMPRESA CLIENTE SA' },
    total_value: 1000,
    totals: { vIBS: 10, vCBS: 9 },
    items: [{
      item_number: 1, description: 'Produto', cfop: '5102', ncm: '1234',
      gross_value: 1000, discount_value: 0, net_value: 1000,
      taxes_current: {},
      rtc: { vIBS: 10, vCBS: 9 },
      rtc_impact: 'CREDIT',
    }],
    status: 'VALID',
    source_filename: 'test.xml',
    raw_xml: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// TESTES DE PRIVACIDADE — os mais críticos
// ---------------------------------------------------------------------------

describe('AiContextService — Privacidade (fronteira crítica)', () => {

  it('não deve incluir CNPJs individuais no contexto', () => {
    const docs = [
      makeDoc({ issuer: { cnpj_cpf: '12345678000100', name: 'FORNECEDOR A' } }),
      makeDoc({ issuer: { cnpj_cpf: '98765432000100', name: 'FORNECEDOR B' } }),
    ]
    const context    = buildAiContext(docs)
    const contextStr = JSON.stringify(context)

    expect(contextStr).not.toContain('12345678000100')
    expect(contextStr).not.toContain('98765432000100')
    expect(contextStr).not.toContain('12345678')
  })

  it('não deve incluir nomes de empresas no contexto', () => {
    const docs = [
      makeDoc({ issuer: { cnpj_cpf: '12345678000100', name: 'EMPRESA SECRETA LTDA' } }),
    ]
    const context    = buildAiContext(docs)
    const contextStr = JSON.stringify(context)

    expect(contextStr).not.toContain('EMPRESA SECRETA LTDA')
  })

  it('não deve incluir chaves de acesso no contexto', () => {
    const docs = [makeDoc({ access_key: '35260512345678000100550010000001001000000017' })]
    const context    = buildAiContext(docs)
    const contextStr = JSON.stringify(context)

    expect(contextStr).not.toContain('35260512345678000100550010000001001000000017')
  })

  it('auditContextPrivacy deve detectar CNPJ vazado', () => {
    const docs = [makeDoc()]
    // Forçar um contexto com CNPJ (cenário hipotético de bug)
    const contextoComBug = {
      ...buildAiContext(docs),
      // @ts-expect-error — simulando campo incorreto adicionado por bug
      debugInfo: '12345678000100',
    }
    const violations = auditContextPrivacy(contextoComBug, docs)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('auditContextPrivacy deve retornar vazio para contexto seguro', () => {
    const docs    = [makeDoc()]
    const context = buildAiContext(docs)
    const violations = auditContextPrivacy(context, docs)
    expect(violations).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// TESTES DE CORREÇÃO MATEMÁTICA
// ---------------------------------------------------------------------------

describe('AiContextService — Agregações matemáticas', () => {

  it('deve retornar contexto vazio para lista sem documentos', () => {
    const context = buildAiContext([])
    expect(context.totalDocs).toBe(0)
    expect(context.ibscbs.credito).toBe(0)
    expect(context.ibscbs.debito).toBe(0)
    expect(context.volumes.total).toBe(0)
  })

  it('deve somar crédito e débito corretamente', () => {
    const docs = [
      makeDoc({ direction: 'INBOUND',  total_value: 1000, items: [{ item_number:1, description:'A', cfop:'5102', ncm:'', gross_value:1000, discount_value:0, net_value:1000, taxes_current:{}, rtc:{ vIBS:10, vCBS:9 }, rtc_impact:'CREDIT' }] }),
      makeDoc({ direction: 'OUTBOUND', total_value: 2000, items: [{ item_number:1, description:'B', cfop:'5102', ncm:'', gross_value:2000, discount_value:0, net_value:2000, taxes_current:{}, rtc:{ vIBS:20, vCBS:18 }, rtc_impact:'DEBIT'  }] }),
    ]
    const ctx = buildAiContext(docs)

    expect(ctx.ibscbs.credito).toBeCloseTo(19, 2) // 10 + 9
    expect(ctx.ibscbs.debito).toBeCloseTo(38, 2)  // 20 + 18
    expect(ctx.ibscbs.saldo).toBeCloseTo(-19, 2)  // 19 - 38
  })

  it('deve calcular volumes INBOUND e OUTBOUND separadamente', () => {
    const docs = [
      makeDoc({ direction: 'INBOUND',  total_value: 3000 }),
      makeDoc({ direction: 'OUTBOUND', total_value: 7000 }),
    ]
    const ctx = buildAiContext(docs)

    expect(ctx.volumes.inbound).toBeCloseTo(3000, 2)
    expect(ctx.volumes.outbound).toBeCloseTo(7000, 2)
    expect(ctx.volumes.total).toBeCloseTo(10000, 2)
  })

  it('deve calcular índices percentuais corretamente', () => {
    const docs = [
      makeDoc({ direction: 'INBOUND', total_value: 1000, items: [{ item_number:1, description:'', cfop:'5102', ncm:'', gross_value:1000, discount_value:0, net_value:1000, taxes_current:{}, rtc:{ vIBS:50, vCBS:50 }, rtc_impact:'CREDIT' }] }),
    ]
    const ctx = buildAiContext(docs)

    // 100 / 1000 = 10%
    expect(ctx.ibscbs.creditRate).toBeCloseTo(10, 2)
  })

  it('deve contar regimes tributários corretamente', () => {
    const docs = [
      makeDoc({ tax_regime: 'RPA'             }),
      makeDoc({ tax_regime: 'RPA'             }),
      makeDoc({ tax_regime: 'SIMPLES_NACIONAL'}),
      makeDoc({ tax_regime: 'MEI'             }),
    ]
    const ctx = buildAiContext(docs)

    expect(ctx.byRegime.rpa).toBe(2)
    expect(ctx.byRegime.simples).toBe(1)
    expect(ctx.byRegime.mei).toBe(1)
  })

  it('deve contar inconformidades corretamente', () => {
    const conforme = makeDoc({
      tax_regime: 'RPA', direction: 'INBOUND',
      issue_date: '2026-03-01T00:00:00-03:00',
      totals: { vIBS: 10, vCBS: 9 },
    })
    const inconforme = makeDoc({
      tax_regime: 'RPA', direction: 'INBOUND',
      issue_date: '2026-03-01T00:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })
    const simples = makeDoc({
      tax_regime: 'SIMPLES_NACIONAL', direction: 'INBOUND',
      issue_date: '2026-03-01T00:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })

    const ctx = buildAiContext([conforme, inconforme, simples])
    expect(ctx.inconformes).toBe(1) // apenas o RPA sem IBS
  })

  it('deve identificar os top CFOPs por volume', () => {
    const docs = [
      makeDoc({ items: [{ item_number:1, description:'', cfop:'5102', ncm:'', gross_value:1000, discount_value:0, net_value:1000, taxes_current:{}, rtc:{ vIBS:100, vCBS:90 }, rtc_impact:'CREDIT' }] }),
      makeDoc({ items: [{ item_number:1, description:'', cfop:'6102', ncm:'', gross_value:2000, discount_value:0, net_value:2000, taxes_current:{}, rtc:{ vIBS:50,  vCBS:45 }, rtc_impact:'CREDIT' }] }),
    ]
    const ctx = buildAiContext(docs)

    expect(ctx.topCfops[0]?.cfop).toBe('5102') // maior volume (190)
    expect(ctx.topCfops.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// TESTES DE PERÍODO
// ---------------------------------------------------------------------------

describe('AiContextService — Período', () => {
  it('deve identificar período corretamente com múltiplos meses', () => {
    const docs = [
      makeDoc({ issue_date: '2026-01-10T00:00:00-03:00' }),
      makeDoc({ issue_date: '2026-03-20T00:00:00-03:00' }),
    ]
    const ctx = buildAiContext(docs)
    expect(ctx.period).toContain('26') // contém o ano
  })

  it('deve retornar período único quando todos os docs são do mesmo mês', () => {
    const docs = [
      makeDoc({ issue_date: '2026-02-10T00:00:00-03:00' }),
      makeDoc({ issue_date: '2026-02-20T00:00:00-03:00' }),
    ]
    const ctx = buildAiContext(docs)
    // Mês único — não tem separador "–"
    expect(ctx.period).not.toContain('–')
  })
})
