import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ParserNFSe } from '@/infrastructure/parsers/ParserNFSe'

const FIXTURES = resolve(__dirname, '../fixtures/nfse')
const read = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf-8')

const parser = new ParserNFSe()

describe('ParserNFSe — com IBS/CBS (totCIBS)', () => {
  const xml    = read('nfse_com_ibscbs.xml')
  const result = parser.parse(xml, 'nfse_com_ibscbs.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
    expect(result.document).not.toBeNull()
  })

  it('deve identificar tipo NFSE', () => {
    expect(result.document?.document_type).toBe('NFSE')
  })

  it('deve ter exatamente 1 item (serviço)', () => {
    expect(result.document?.items).toHaveLength(1)
  })

  it('deve extrair valor total do serviço', () => {
    expect(result.document?.total_value).toBeCloseTo(23355.40, 2)
  })

  it('deve extrair ISS no item', () => {
    const tc = result.document?.items[0]?.taxes_current
    expect(tc?.iss_base).toBeGreaterThan(0)
    expect(tc?.iss_value).toBeGreaterThan(0)
    expect(tc?.iss_rate).toBeGreaterThan(0)
  })

  it('deve extrair IBS/CBS nos totais', () => {
    const totals = result.document?.totals
    expect(totals?.vIBS).toBeCloseTo(22.89, 2)
    expect(totals?.vCBS).toBeCloseTo(205.99, 2)
  })

  it('deve extrair IBS/CBS no item', () => {
    const rtc = result.document?.items[0]?.rtc
    expect(rtc?.vIBS).toBeGreaterThan(0)
    expect(rtc?.vCBS).toBeGreaterThan(0)
  })

  it('deve extrair código do serviço (cTribNac) no cfop', () => {
    expect(result.document?.items[0]?.cfop).toBeTruthy()
  })

  it('deve extrair IR retido nas retenções federais', () => {
    const tc = result.document?.items[0]?.taxes_current
    expect(tc?.ir_value).toBeGreaterThanOrEqual(0)
  })
})

describe('ParserNFSe — sem IBS/CBS', () => {
  const xml    = read('nfse_sem_ibscbs.xml')
  const result = parser.parse(xml, 'nfse_sem_ibscbs.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
  })

  it('campos IBS/CBS devem ser zero ou ausentes', () => {
    expect(result.document?.totals.vIBS ?? 0).toBe(0)
    expect(result.document?.totals.vCBS ?? 0).toBe(0)
  })
})

describe('ParserNFSe — XML inválido', () => {
  it('não deve lançar exceção', () => {
    const result = parser.parse('<invalido/>', 'invalido.xml')
    expect(result.success).toBe(false)
    expect(result.document).toBeNull()
  })
})
