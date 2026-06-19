/**
 * @file IXmlParser.ts
 * @description Contrato (interface) que todos os parsers de documento devem implementar.
 *
 * O padrão Strategy é aplicado aqui: o ParserFactory seleciona a implementação
 * correta sem que o chamador precise saber qual parser está sendo usado.
 *
 * Para adicionar suporte a um novo tipo de documento no futuro:
 * 1. Criar nova classe que implementa IXmlParser
 * 2. Registrar no ParserFactory
 * Nenhuma outra alteração é necessária.
 */

import type { ParseResult } from '@/domain/models/FiscalDocument'

export interface IXmlParser {
  /**
   * Processa um XML bruto e retorna o documento fiscal estruturado.
   *
   * Contrato:
   * - Nunca lança exceção — erros são capturados e retornados via ParseResult.logs
   * - Se o XML for irrecuperável, retorna { document: null, success: false, logs: [...] }
   * - Se o XML for parcialmente válido, retorna { document: {...}, success: true, status: 'PARTIAL', logs: [...] }
   *
   * @param xmlString - Conteúdo bruto do arquivo XML
   * @param filename  - Nome do arquivo (para logs de rastreabilidade)
   */
  parse(xmlString: string, filename: string): ParseResult
}
