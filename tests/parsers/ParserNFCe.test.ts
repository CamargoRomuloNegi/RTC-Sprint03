import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ParserNFCe } from '@/infrastructure/parsers/ParserNFCe'

const FIXTURES = resolve(__dirname, '../fixtures/nfce')
const read = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf-8')

const parser = new ParserNFCe()

describe('ParserNFCe — consumidor anônimo (sem dest)', () => {
  const xml    = read('nfce_consumidor_anonimo.xml')
  const result = parser.parse(xml, 'nfce_consumidor_anonimo.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
  })

  it('deve identificar tipo NFCE', () => {
    expect(result.document?.document_type).toBe('NFCE')
  })

  it('receiver deve ser CONSUMIDOR FINAL quando dest ausente', () => {
    expect(result.document?.receiver.cnpj_cpf).toBe('CONSUMIDOR_FINAL')
    expect(result.document?.receiver.name).toBe('CONSUMIDOR FINAL')
  })

  it('deve ter chave de acesso de 44 dígitos', () => {
    expect(result.document?.access_key).toHaveLength(44)
  })

  it('CFOPs devem ser do grupo 5.xxx', () => {
    const cfops = result.document?.items.map((i) => i.cfop) ?? []
    cfops.forEach((c) => expect(c.startsWith('5')).toBe(true))
  })
})

describe('ParserNFCe — consumidor identificado (com CPF)', () => {
  const xml    = read('nfce_consumidor_identificado.xml')
  const result = parser.parse(xml, 'nfce_consumidor_identificado.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
  })

  it('receiver deve ter CPF informado', () => {
    expect(result.document?.receiver.cnpj_cpf).not.toBe('CONSUMIDOR_FINAL')
    expect(result.document?.receiver.cnpj_cpf.length).toBeGreaterThanOrEqual(11)
  })
})

describe('ParserNFCe — múltiplos itens', () => {
  const xml    = read('nfce_multi_item.xml')
  const result = parser.parse(xml, 'nfce_multi_item.xml')

  it('deve processar com sucesso', () => {
    expect(result.success).toBe(true)
  })

  it('deve extrair mais de 1 item', () => {
    expect((result.document?.items.length ?? 0)).toBeGreaterThan(1)
  })

  it('cada item deve ter gross_value > 0', () => {
    result.document?.items.forEach((item) => {
      expect(item.gross_value).toBeGreaterThan(0)
    })
  })

  it('NFC-e Simples não deve ter IBS/CBS', () => {
    result.document?.items.forEach((item) => {
      expect(item.rtc.vIBS ?? 0).toBe(0)
      expect(item.rtc.vCBS ?? 0).toBe(0)
    })
  })
})
