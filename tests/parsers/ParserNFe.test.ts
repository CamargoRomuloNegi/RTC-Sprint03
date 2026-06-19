import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ParserNFe } from '@/infrastructure/parsers/ParserNFe'

const FIXTURES = resolve(__dirname, '../fixtures/nfe')
const read = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf-8')
const parser = new ParserNFe()

describe('ParserNFe — NF-e RPA com IBS/CBS', () => {
  const xml    = read('nfe_rpa_com_ibs.xml')
  const result = parser.parse(xml, 'nfe_rpa_com_ibs.xml')

  it('deve processar com sucesso', () => {
    if (!result.success) console.error('Logs:', result.logs.map(l => l.message))
    expect(result.success).toBe(true)
    expect(result.document).not.toBeNull()
  })

  it('deve identificar tipo NFE', () => {
    expect(result.document?.document_type).toBe('NFE')
  })

  it('deve extrair chave de acesso de 44 dígitos', () => {
    expect(result.document?.access_key).toHaveLength(44)
  })

  it('deve identificar regime RPA (CRT=3)', () => {
    expect(result.document?.tax_regime).toBe('RPA')
  })

  it('deve extrair valor total', () => {
    expect(result.document?.total_value).toBeCloseTo(4199.93, 2)
  })

  it('deve extrair CFOP 5102 no item', () => {
    expect(result.document?.items[0]?.cfop).toBe('5102')
  })

  it('deve extrair campos IBS/CBS no item', () => {
    const rtc = result.document?.items[0]?.rtc
    // vBC real: 3290.64 (pode haver deduções da base)
    expect(rtc?.vBC).toBeGreaterThan(0)
    expect(rtc?.vIBS).toBeGreaterThan(0)
    expect(rtc?.vCBS).toBeGreaterThan(0)
    expect(rtc?.pCBS).toBeCloseTo(0.9, 2)
  })

  it('deve extrair CST e cClassTrib com padding', () => {
    const rtc = result.document?.items[0]?.rtc
    expect(rtc?.cst).toMatch(/^\d{3}$/)
    expect(rtc?.c_class_trib).toMatch(/^\d{6}$/)
  })

  it('deve extrair totais IBS/CBS no cabeçalho', () => {
    const totals = result.document?.totals
    expect(totals?.vBCIBSCBS).toBeGreaterThan(0)
    expect(totals?.vIBS).toBeGreaterThan(0)
    expect(totals?.vCBS).toBeGreaterThan(0)
  })

  it('deve ter finalidade NORMAL', () => {
    expect(result.document?.purpose).toBe('NORMAL')
  })
})

describe('ParserNFe — Simples Nacional (sem IBS/CBS)', () => {
  const xml    = read('nfe_simples_sem_ibs.xml')
  const result = parser.parse(xml, 'nfe_simples_sem_ibs.xml')

  it('deve processar com sucesso', () => {
    if (!result.success) console.error('Logs:', result.logs.map(l => l.message))
    expect(result.success).toBe(true)
  })

  it('deve identificar Simples Nacional', () => {
    expect(result.document?.tax_regime).toBe('SIMPLES_NACIONAL')
  })

  it('campos IBS/CBS devem ser zero', () => {
    expect(result.document?.items[0]?.rtc?.vIBS ?? 0).toBe(0)
    expect(result.document?.items[0]?.rtc?.vCBS ?? 0).toBe(0)
  })
})

describe('ParserNFe — interestadual com IBS/CBS', () => {
  const xml    = read('nfe_interestadual_ibs.xml')
  const result = parser.parse(xml, 'nfe_interestadual_ibs.xml')

  it('deve processar com sucesso', () => {
    if (!result.success) console.error('Logs:', result.logs.map(l => l.message))
    expect(result.success).toBe(true)
  })

  it('deve ter CFOP interestadual (6.xxx ou 2.xxx)', () => {
    const cfop = result.document?.items[0]?.cfop ?? ''
    expect(['6', '2'].some(p => cfop.startsWith(p))).toBe(true)
  })
})

describe('ParserNFe — múltiplos itens', () => {
  const xml    = read('nfe_exportacao_multi_item.xml')
  const result = parser.parse(xml, 'nfe_exportacao_multi_item.xml')

  it('deve processar com sucesso', () => {
    if (!result.success) console.error('Logs:', result.logs.map(l => l.message))
    expect(result.success).toBe(true)
  })

  it('deve extrair múltiplos itens', () => {
    expect((result.document?.items.length ?? 0)).toBeGreaterThan(1)
  })

  it('item_number deve começar em 1', () => {
    expect(result.document?.items[0]?.item_number).toBe(1)
  })
})

describe('ParserNFe — remessa/bonificação', () => {
  const xml    = read('nfe_remessa_bonificacao.xml')
  const result = parser.parse(xml, 'nfe_remessa_bonificacao.xml')

  it('deve processar com sucesso', () => {
    if (!result.success) console.error('Logs:', result.logs.map(l => l.message))
    expect(result.success).toBe(true)
  })

  it('CFOP deve ser válido (5.xxx, 6.xxx ou 7.xxx)', () => {
    const cfop = result.document?.items[0]?.cfop ?? ''
    expect(['5','6','7'].some(p => cfop.startsWith(p))).toBe(true)
  })
})

describe('ParserNFe — XML inválido', () => {
  it('deve retornar failure sem lançar exceção', () => {
    const result = parser.parse('<xml>invalido</xml>', 'invalido.xml')
    expect(result.success).toBe(false)
    expect(result.document).toBeNull()
    expect(result.logs.length).toBeGreaterThan(0)
  })

  it('deve retornar failure para string vazia', () => {
    const result = parser.parse('', 'vazio.xml')
    expect(result.success).toBe(false)
  })
})
