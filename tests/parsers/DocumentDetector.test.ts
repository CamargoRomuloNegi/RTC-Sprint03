import { describe, it, expect } from 'vitest'
import { detectDocumentType } from '@/infrastructure/parsers/DocumentDetector'

const nfe55 = '<nfeProc><NFe><infNFe><ide><mod>55</mod></ide></infNFe></NFe></nfeProc>'
const nfe65 = '<nfeProc><NFe><infNFe><ide><mod>65</mod></ide></infNFe></NFe></nfeProc>'
const cte   = '<cteProc><CTe><infCte></infCte></CTe></cteProc>'
const nfseNacional = '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe/></NFSe>'
const nfseAbrasf   = '<CompNfse><Nfse><InfNfse/></Nfse></CompNfse>'

describe('DocumentDetector', () => {
  it('deve detectar NF-e modelo 55', () => {
    expect(detectDocumentType(nfe55, 'test.xml').type).toBe('NFE')
  })

  it('deve detectar NFC-e modelo 65', () => {
    expect(detectDocumentType(nfe65, 'test.xml').type).toBe('NFCE')
  })

  it('deve detectar CT-e', () => {
    expect(detectDocumentType(cte, 'test.xml').type).toBe('CTE')
  })

  it('deve detectar NFS-e Nacional pelo namespace', () => {
    expect(detectDocumentType(nfseNacional, 'test.xml').type).toBe('NFSE')
  })

  it('deve rejeitar NFS-e ABRASF com WARN', () => {
    const result = detectDocumentType(nfseAbrasf, 'test.xml')
    expect(result.type).toBe('UNKNOWN')
    expect(result.logs[0]?.level).toBe('WARN')
  })

  it('deve retornar UNKNOWN para XML não reconhecido', () => {
    expect(detectDocumentType('<dados><qualquer/></dados>', 'test.xml').type).toBe('UNKNOWN')
  })
})
