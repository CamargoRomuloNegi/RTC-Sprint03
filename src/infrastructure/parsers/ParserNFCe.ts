/**
 * @file ParserNFCe.ts
 * @description Parser para NFC-e (Nota Fiscal de Consumidor Eletrônica) — Modelo 65.
 * Leiaute 4.00 — mesmo XSD da NF-e, comportamento distinto em 3 pontos.
 *
 * DIFERENÇAS em relação ao ParserNFe:
 *   1. document_type = 'NFCE'
 *   2. <dest> é OPCIONAL — consumidor pode ser anônimo
 *   3. <autXML> contém CPF do responsável técnico — NÃO é o consumidor, ignorar
 *
 * DADOS DA MASSA REAL (576 arquivos analisados):
 *   - 100% CRT 2 (Simples MEI) — sem IBSCBS nesta massa
 *   - 551 de 576 sem nó <dest> (consumidor anônimo)
 *   - 461 de 576 com múltiplos itens — isArray para det é crítico
 *   - CFOPs: 5102 e 5405 dominantes
 *   - IBSCBS previsto para emitentes RPA (não havia na massa, mas tratado)
 */

import { ParserNFe } from './ParserNFe'
import type { ParseResult, DocumentType } from '@/domain/models/FiscalDocument'

export class ParserNFCe extends ParserNFe {
  protected override readonly docType: DocumentType = 'NFCE'

  override parse(xmlString: string, filename: string): ParseResult {
    // Toda a lógica de parsing é idêntica à NF-e.
    // O ParserNFe já trata dest ausente via consumidorFinal().
    // O docType 'NFCE' é propagado via this.docType.
    return super.parse(xmlString, filename)
  }
}
