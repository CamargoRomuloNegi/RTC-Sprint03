import { describe, it, expect } from 'vitest'
import {
  detectMainCnpjRoot,
  enrichDocument,
  determineRtcImpact,
  calculateApuracao,
  getInconformes,
} from '@/application/services/TaxAnalyzerService'
import type { FiscalDocument } from '@/domain/models/FiscalDocument'

// ---------------------------------------------------------------------------
// FÁBRICA DE DOCUMENTOS PARA TESTE
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<FiscalDocument> = {}): FiscalDocument {
  return {
    access_key:      '35260500000000000000550010000000011000000001',
    document_type:   'NFE',
    version:         '4.00',
    issue_date:      '2026-03-15T10:00:00-03:00',
    purpose:         'NORMAL',
    tax_regime:      'RPA',
    issuer:   { cnpj_cpf: '12345678000100', name: 'EMITENTE TESTE' },
    receiver: { cnpj_cpf: '98765432000100', name: 'DESTINATARIO TESTE' },
    total_value: 1000,
    totals: { vProd: 1000, vIBS: 10, vCBS: 9 },
    items: [{
      item_number: 1, description: 'Produto Teste',
      cfop: '5102', ncm: '84143020',
      gross_value: 1000, discount_value: 0, net_value: 1000,
      taxes_current: {},
      rtc: { vIBS: 10, vCBS: 9 },
    }],
    status: 'VALID',
    source_filename: 'teste.xml',
    raw_xml: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
describe('detectMainCnpjRoot', () => {
  it('deve detectar o CNPJ raiz que mais aparece', () => {
    const docs = [
      makeDoc({ issuer:   { cnpj_cpf: '12345678000100', name: 'A' },
                receiver: { cnpj_cpf: '99999999000100', name: 'B' } }),
      makeDoc({ issuer:   { cnpj_cpf: '12345678000100', name: 'A' },
                receiver: { cnpj_cpf: '88888888000100', name: 'C' } }),
      makeDoc({ issuer:   { cnpj_cpf: '77777777000100', name: 'D' },
                receiver: { cnpj_cpf: '12345678000100', name: 'A' } }),
    ]
    const result = detectMainCnpjRoot(docs)
    expect(result.cnpjRoot).toBe('12345678')
    expect(result.frequency).toBe(3)
  })

  it('deve retornar null para lista vazia', () => {
    const result = detectMainCnpjRoot([])
    expect(result.cnpjRoot).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('determineRtcImpact', () => {
  it('INBOUND com CFOP comercial → CREDIT', () => {
    expect(determineRtcImpact('5102', 'INBOUND')).toBe('CREDIT')
    expect(determineRtcImpact('6102', 'INBOUND')).toBe('CREDIT')
  })

  it('OUTBOUND com CFOP comercial → DEBIT', () => {
    expect(determineRtcImpact('5102', 'OUTBOUND')).toBe('DEBIT')
  })

  it('CFOP de remessa/bonificação → NEUTRAL', () => {
    expect(determineRtcImpact('5910', 'OUTBOUND')).toBe('NEUTRAL')
    expect(determineRtcImpact('6949', 'OUTBOUND')).toBe('NEUTRAL')
    expect(determineRtcImpact('5911', 'INBOUND')).toBe('NEUTRAL')
  })

  it('CFOP de exportação → NEUTRAL', () => {
    expect(determineRtcImpact('7101', 'OUTBOUND')).toBe('NEUTRAL')
  })

  it('UNKNOWN direction → NEUTRAL', () => {
    expect(determineRtcImpact('5102', 'UNKNOWN')).toBe('NEUTRAL')
  })

  it('CFOP com ponto deve ser normalizado', () => {
    expect(determineRtcImpact('5.102', 'INBOUND')).toBe('CREDIT')
    expect(determineRtcImpact('5.910', 'OUTBOUND')).toBe('NEUTRAL')
  })
})

// ---------------------------------------------------------------------------
describe('enrichDocument', () => {
  it('deve definir OUTBOUND quando empresa é o emitente', () => {
    const doc = makeDoc({
      issuer:   { cnpj_cpf: '12345678000100', name: 'EMPRESA' },
      receiver: { cnpj_cpf: '99999999000100', name: 'CLIENTE' },
    })
    const enriched = enrichDocument(doc, '12345678')
    expect(enriched.direction).toBe('OUTBOUND')
  })

  it('deve definir INBOUND quando empresa é o destinatário', () => {
    const doc = makeDoc({
      issuer:   { cnpj_cpf: '99999999000100', name: 'FORNECEDOR' },
      receiver: { cnpj_cpf: '12345678000100', name: 'EMPRESA' },
    })
    const enriched = enrichDocument(doc, '12345678')
    expect(enriched.direction).toBe('INBOUND')
  })

  it('deve definir UNKNOWN quando empresa não participa', () => {
    const doc = makeDoc({
      issuer:   { cnpj_cpf: '11111111000100', name: 'A' },
      receiver: { cnpj_cpf: '22222222000100', name: 'B' },
    })
    const enriched = enrichDocument(doc, '33333333')
    expect(enriched.direction).toBe('UNKNOWN')
  })

  it('itens INBOUND devem receber rtc_impact CREDIT', () => {
    const doc = makeDoc({
      issuer:   { cnpj_cpf: '99999999000100', name: 'FORNECEDOR' },
      receiver: { cnpj_cpf: '12345678000100', name: 'EMPRESA' },
    })
    const enriched = enrichDocument(doc, '12345678')
    expect(enriched.items[0]?.rtc_impact).toBe('CREDIT')
  })

  it('itens OUTBOUND devem receber rtc_impact DEBIT', () => {
    const doc = makeDoc({
      issuer:   { cnpj_cpf: '12345678000100', name: 'EMPRESA' },
      receiver: { cnpj_cpf: '99999999000100', name: 'CLIENTE' },
    })
    const enriched = enrichDocument(doc, '12345678')
    expect(enriched.items[0]?.rtc_impact).toBe('DEBIT')
  })

  it('não deve modificar o documento original (imutável)', () => {
    const doc = makeDoc()
    enrichDocument(doc, '12345678')
    expect(doc.direction).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
describe('calculateApuracao', () => {
  it('deve somar créditos, débitos e calcular saldo', () => {
    const docs = [
      makeDoc({
        issuer:   { cnpj_cpf: '99999999000100', name: 'FORN' },
        receiver: { cnpj_cpf: '12345678000100', name: 'EMP' },
        direction: 'INBOUND',
        totals: { vIBS: 10, vCBS: 9 },
        items: [{ item_number: 1, description: 'A', cfop: '5102', ncm: '',
                  gross_value: 1000, discount_value: 0, net_value: 1000,
                  taxes_current: {}, rtc: { vIBS: 10, vCBS: 9 }, rtc_impact: 'CREDIT' }],
      }),
      makeDoc({
        issuer:   { cnpj_cpf: '12345678000100', name: 'EMP' },
        receiver: { cnpj_cpf: '99999999000100', name: 'CLI' },
        direction: 'OUTBOUND',
        totals: { vIBS: 20, vCBS: 18 },
        items: [{ item_number: 1, description: 'B', cfop: '5102', ncm: '',
                  gross_value: 2000, discount_value: 0, net_value: 2000,
                  taxes_current: {}, rtc: { vIBS: 20, vCBS: 18 }, rtc_impact: 'DEBIT' }],
      }),
    ]

    const summary = calculateApuracao(docs)
    expect(summary.totalCreditos).toBeCloseTo(19, 2)   // 10 + 9
    expect(summary.totalDebitos).toBeCloseTo(38, 2)    // 20 + 18
    expect(summary.saldo).toBeCloseTo(-19, 2)          // devedor
  })

  it('deve contar docs com e sem IBS/CBS', () => {
    const docs = [
      makeDoc({ totals: { vIBS: 10, vCBS: 9 }, tax_regime: 'RPA' }),
      makeDoc({ totals: { vIBS: 0,  vCBS: 0 }, tax_regime: 'RPA' }),
      makeDoc({ totals: { vIBS: 0,  vCBS: 0 }, tax_regime: 'SIMPLES_NACIONAL' }),
    ]
    const summary = calculateApuracao(docs)
    expect(summary.docsComIBSCBS).toBe(1)
    expect(summary.docsSemIBSCBS).toBe(1)
    expect(summary.docsSimples).toBe(1)
  })
})

// ---------------------------------------------------------------------------
describe('getInconformes', () => {
  it('deve detectar RPA 2026+ sem IBS/CBS em INBOUND', () => {
    const doc = makeDoc({
      tax_regime: 'RPA',
      direction:  'INBOUND',
      issue_date: '2026-03-15T10:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })
    expect(getInconformes([doc])).toHaveLength(1)
  })

  it('não deve flagrar Simples Nacional como inconformidade', () => {
    const doc = makeDoc({
      tax_regime: 'SIMPLES_NACIONAL',
      direction:  'INBOUND',
      issue_date: '2026-03-15T10:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })
    expect(getInconformes([doc])).toHaveLength(0)
  })

  it('não deve flagrar documentos anteriores a 2026', () => {
    const doc = makeDoc({
      tax_regime: 'RPA',
      direction:  'INBOUND',
      issue_date: '2025-06-15T10:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })
    expect(getInconformes([doc])).toHaveLength(0)
  })

  it('não deve flagrar OUTBOUND', () => {
    const doc = makeDoc({
      tax_regime: 'RPA',
      direction:  'OUTBOUND',
      issue_date: '2026-03-15T10:00:00-03:00',
      totals: { vIBS: 0, vCBS: 0 },
    })
    expect(getInconformes([doc])).toHaveLength(0)
  })
})
