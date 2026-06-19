/**
 * @file ParserFactory.ts
 * @description Factory que instancia e executa o parser correto para cada tipo de documento.
 *
 * PADRÃO: Factory Method + Strategy.
 * - Nenhuma lógica de parsing aqui — apenas seleção e delegação.
 * - Adicionar novo tipo: registrar no map `parsers` e implementar IXmlParser.
 */

import type { DocumentType, ParseResult } from '@/domain/models/FiscalDocument'
import type { IXmlParser } from './IXmlParser'
import { ParserNFe } from './ParserNFe'
import { ParserNFCe } from './ParserNFCe'
import { ParserCTe } from './ParserCTe'
import { ParserNFSe } from './ParserNFSe'

/** Registro de parsers disponíveis por tipo de documento */
const parsers: Partial<Record<DocumentType, IXmlParser>> = {
  NFE: new ParserNFe(),
  NFCE: new ParserNFCe(),
  CTE: new ParserCTe(),
  NFSE: new ParserNFSe(),
}

/**
 * Executa o parser adequado para o tipo de documento informado.
 *
 * @param xmlString   - Conteúdo bruto do XML
 * @param type        - Tipo detectado pelo DocumentDetector
 * @param filename    - Nome do arquivo (rastreabilidade)
 * @returns           - ParseResult com documento e logs
 */
export function parseDocument(xmlString: string, type: DocumentType, filename: string): ParseResult {
  const parser = parsers[type]

  if (!parser) {
    return {
      document: null,
      success: false,
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          category: 'PARSE',
          source: filename,
          message: `Nenhum parser disponível para o tipo "${type}". Documento ignorado.`,
        },
      ],
    }
  }

  return parser.parse(xmlString, filename)
}
