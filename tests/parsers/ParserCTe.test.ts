import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ParserCTe } from '@/infrastructure/parsers/ParserCTe'

const FIXTURES = resolve(__dirname, '../fixtures/cte')
const read = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf-8')

const parser = new ParserCTe()

describe('ParserCTe — RPA com IBS/CBS (CST 000)', () => {
  const xml    = read('cte_rpa_com_ibs.xml')
  const result = parser.parse(xml, 'cte_rpa_com_ibs.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
    expect(result.document).not.toBeNull()
  })

  it('deve identificar tipo CTE', () => {
    expect(result.document?.document_type).toBe('CTE')
  })

  it('deve ter chave de acesso de 44 dígitos', () => {
    expect(result.document?.access_key).toHaveLength(44)
  })

  it('deve extrair versão 4.00', () => {
    expect(result.document?.version).toBe('4.00')
  })

  it('deve extrair valor total da prestação', () => {
    expect(result.document?.total_value).toBeCloseTo(397.73, 2)
  })

  it('deve identificar regime RPA', () => {
    expect(result.document?.tax_regime).toBe('RPA')
  })

  it('deve extrair componentes como itens', () => {
    expect((result.document?.items.length ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('item[0] deve ter IBS/CBS do documento', () => {
    const rtc = result.document?.items[0]?.rtc
    expect(rtc?.vBC).toBeCloseTo(350.00, 2)
    expect(rtc?.vIBS).toBeGreaterThan(0)
    expect(rtc?.vCBS).toBeGreaterThan(0)
  })

  it('totais do documento devem ter IBS/CBS', () => {
    const totals = result.document?.totals
    expect(totals?.vIBS).toBeGreaterThan(0)
    expect(totals?.vCBS).toBeGreaterThan(0)
  })
})

describe('ParserCTe — interestadual', () => {
  const xml    = read('cte_interestadual.xml')
  const result = parser.parse(xml, 'cte_interestadual.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
  })

  it('deve ter finalidade NORMAL ou COMPLEMENTAR', () => {
    expect(['NORMAL', 'COMPLEMENTAR', 'SUBSTITUTO', 'ANULACAO']).toContain(
      result.document?.purpose
    )
  })
})

describe('ParserCTe — XML inválido', () => {
  it('não deve lançar exceção', () => {
    const result = parser.parse('<invalido/>', 'invalido.xml')
    expect(result.success).toBe(false)
    expect(result.document).toBeNull()
  })
})
