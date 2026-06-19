/**
 * @file TaxAnalyzerService.temporal.test.ts
 * @description Testes unitários do Sprint 3 — groupByPeriod e getTemporalHighlights.
 */
import { describe, it, expect } from 'vitest'
import {
  groupByPeriod,
  getTemporalHighlights,
} from '@/application/services/TaxAnalyzerService'
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
    issuer:          { cnpj_cpf: '12345678000100', name: 'EMITENTE' },
    receiver:        { cnpj_cpf: '98765432000100', name: 'DESTINATARIO' },
    total_value:     1000,
    totals:          { vIBS: 10, vCBS: 9 },
    items:           [{
      item_number: 1, description: 'Produto', cfop: '5102', ncm: '1234',
      gross_value: 1000, discount_value: 0, net_value: 1000,
      taxes_current: {},
      rtc: { vIBS: 10, vCBS: 9 },
    }],
    status:          'VALID',
    source_filename: 'test.xml',
    raw_xml:         '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// TESTES groupByPeriod
// ---------------------------------------------------------------------------

describe('groupByPeriod — modo mensal', () => {
  const docs = [
    makeDoc({ issue_date: '2026-01-10T10:00:00-03:00', direction: 'INBOUND',
      items: [{ item_number:1, description:'A', cfop:'5102', ncm:'', gross_value:1000, discount_value:0, net_value:1000, taxes_current:{}, rtc:{ vIBS:5, vCBS:4 }, rtc_impact:'CREDIT' }] }),
    makeDoc({ issue_date: '2026-01-20T10:00:00-03:00', direction: 'OUTBOUND',
      items: [{ item_number:1, description:'B', cfop:'5102', ncm:'', gross_value:2000, discount_value:0, net_value:2000, taxes_current:{}, rtc:{ vIBS:15, vCBS:14 }, rtc_impact:'DEBIT' }] }),
    makeDoc({ issue_date: '2026-02-05T10:00:00-03:00', direction: 'INBOUND',
      items: [{ item_number:1, description:'C', cfop:'5102', ncm:'', gross_value:1500, discount_value:0, net_value:1500, taxes_current:{}, rtc:{ vIBS:10, vCBS:8 }, rtc_impact:'CREDIT' }] }),
  ]

  const periods = groupByPeriod(docs, 'monthly')

  it('deve agrupar em 2 períodos mensais', () => {
    expect(periods).toHaveLength(2)
  })

  it('primeiro período deve ser jan/26', () => {
    expect(periods[0]?.key).toBe('2026-01')
    expect(periods[0]?.label).toBe('Jan/26')
  })

  it('deve acumular crédito e débito corretamente em janeiro', () => {
    const jan = periods[0]!
    expect(jan.credito).toBeCloseTo(9, 2)   // vIBS 5 + vCBS 4
    expect(jan.debito).toBeCloseTo(29, 2)   // vIBS 15 + vCBS 14
    expect(jan.saldo).toBeCloseTo(-20, 2)   // crédito - débito
  })

  it('deve calcular saldo acumulado progressivo', () => {
    const fev = periods[1]!
    // fev: crédito = 18 (10+8), débito = 0, saldo = 18
    // acumulado = jan (-20) + fev (18) = -2
    expect(fev.saldoAcumulado).toBeCloseTo(-2, 2)
  })

  it('deve contar documentos por período', () => {
    expect(periods[0]?.docCount).toBe(2) // 2 docs em janeiro
    expect(periods[1]?.docCount).toBe(1) // 1 doc em fevereiro
  })
})

describe('groupByPeriod — modo trimestral', () => {
  const docs = [
    makeDoc({ issue_date: '2026-01-15T10:00:00-03:00' }), // Q1
    makeDoc({ issue_date: '2026-03-20T10:00:00-03:00' }), // Q1
    makeDoc({ issue_date: '2026-04-10T10:00:00-03:00' }), // Q2
  ]

  const periods = groupByPeriod(docs, 'quarterly')

  it('deve agrupar em 2 trimestres', () => {
    expect(periods).toHaveLength(2)
  })

  it('chave do primeiro trimestre deve ser 2026-Q1', () => {
    expect(periods[0]?.key).toBe('2026-Q1')
    expect(periods[0]?.label).toContain('Tri')
  })

  it('Q1 deve ter 2 documentos', () => {
    expect(periods[0]?.docCount).toBe(2)
  })
})

describe('groupByPeriod — casos especiais', () => {
  it('documento sem data vai para período sem-data', () => {
    const docs = [makeDoc({ issue_date: '' })]
    const periods = groupByPeriod(docs, 'monthly')
    expect(periods[0]?.key).toBe('sem-data')
    expect(periods[0]?.label).toBe('Sem data')
  })

  it('lista vazia retorna array vazio', () => {
    expect(groupByPeriod([], 'monthly')).toHaveLength(0)
  })

  it('períodos são ordenados cronologicamente', () => {
    const docs = [
      makeDoc({ issue_date: '2026-03-01T00:00:00-03:00' }),
      makeDoc({ issue_date: '2026-01-01T00:00:00-03:00' }),
      makeDoc({ issue_date: '2026-02-01T00:00:00-03:00' }),
    ]
    const keys = groupByPeriod(docs, 'monthly').map(p => p.key)
    expect(keys).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})

// ---------------------------------------------------------------------------
// TESTES getTemporalHighlights
// ---------------------------------------------------------------------------

describe('getTemporalHighlights', () => {
  const makePeriod = (key: string, saldo: number, acc: number): ReturnType<typeof groupByPeriod>[0] => ({
    key, label: key, docCount: 1, docsComIBS: 1,
    totalValue: 1000, credito: saldo > 0 ? saldo : 0,
    debito: saldo < 0 ? Math.abs(saldo) : 0,
    saldo, saldoAcumulado: acc,
  })

  it('deve identificar melhor e pior período', () => {
    const periods = [
      makePeriod('2026-01', 100, 100),
      makePeriod('2026-02', -50, 50),
      makePeriod('2026-03', 200, 250),
      makePeriod('2026-04', -10, 240),
    ]
    const h = getTemporalHighlights(periods)
    expect(h.best?.key).toBe('2026-03')   // saldo 200
    expect(h.worst?.key).toBe('2026-02')  // saldo -50
  })

  it('deve retornar insufficient com menos de 4 períodos', () => {
    const periods = [makePeriod('2026-01', 10, 10), makePeriod('2026-02', 20, 30)]
    const h = getTemporalHighlights(periods)
    expect(h.trend).toBe('insufficient')
  })

  it('deve retornar null para lista vazia', () => {
    const h = getTemporalHighlights([])
    expect(h.best).toBeNull()
    expect(h.worst).toBeNull()
  })
})
