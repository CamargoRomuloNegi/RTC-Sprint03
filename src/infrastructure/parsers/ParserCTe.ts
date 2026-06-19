/**
 * @file ParserCTe.ts
 * @description Parser para CT-e (Conhecimento de Transporte Eletrônico) — Modelo 57.
 * Leiaute 4.00 (confirmado na massa real — não 3.00 como documentação antiga indicava).
 *
 * ESTRUTURA XML:
 *   cteProc > CTe > infCte  (com protocolo)
 *   CTe > infCte            (avulso)
 *
 * PARTICULARIDADES CONFIRMADAS NA MASSA REAL (12 arquivos):
 *   - Versão 4.00 em todos os arquivos
 *   - tpCTe no lugar de finCTe (0=Normal, 1=Complementar, 2=Anulação, 3=Substituto)
 *   - IBSCBS em dois padrões:
 *       CST 000 → tributado, com gIBSCBS completo (vBC, gIBSUF, gIBSMun, vIBS, gCBS)
 *       CST 410 → não incidência, apenas CST + cClassTrib (sem valores financeiros)
 *   - Tributos no nível do DOCUMENTO (infCte.imp), não por componente
 *   - Comp[] = decomposição do valor do frete (item[0] recebe tributos; demais ficam vazios)
 *   - referenced_keys: chaves NF-e em infCTeNorm.infDoc.infNFe[].chave
 */

import { XMLParser } from 'fast-xml-parser'
import type { IXmlParser } from './IXmlParser'
import type {
  ParseResult, FiscalDocument, DocumentItem,
  ItemTaxesCurrent, ItemTaxesRTC, DocumentTotals,
  Participant, TaxRegime, DocumentPurpose, ProcessingLog,
} from '@/domain/models/FiscalDocument'
import { toNumber } from '@/lib/utils'

const XML_PARSER_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  isArray: (name: string) => name === 'Comp' || name === 'infNFe',
} as const

export class ParserCTe implements IXmlParser {
  private readonly xmlParser = new XMLParser(XML_PARSER_CONFIG)

  parse(xmlString: string, filename: string): ParseResult {
    const logs: ProcessingLog[] = []

    try {
      const parsed = this.xmlParser.parse(xmlString)

      // Navegar até infCte
      const root = this.getInfCte(parsed)
      if (!root) {
        return this.fatal(filename, 'Nó infCte não encontrado. Verifique se é um CT-e válido.')
      }

      const ide  = (root.ide  ?? {}) as Record<string, unknown>
      const emit = (root.emit ?? {}) as Record<string, unknown>
      const rem  = root.rem  as Record<string, unknown> | undefined
      const dest = root.dest as Record<string, unknown> | undefined

      // Chave de acesso
      const rawId = String(root['@_Id'] ?? '')
      const access_key = rawId.replace(/^CTe/, '') || filename

      // parseAttributeValue converte "4.00" → 4; preservar string original via regex
      const versionMatch = xmlString.match(/infCte[^>]*versao="([^"]+)"/)
      const version    = versionMatch?.[1] ?? String(root['@_versao'] ?? '4.00')
      const issue_date = String(ide.dhEmi ?? '')
      const cfop_doc   = String(ide.CFOP ?? '')

      // Finalidade — CT-e usa tpCTe (versão 4.00)
      const purpose = this.mapPurpose(Number(ide.tpCTe ?? ide.finCTe ?? 0))

      // Participantes
      const issuer   = this.extractParticipant(emit, 'emit')
      const receiver = dest ? this.extractParticipant(dest, 'dest') : this.unknown()
      const sender   = rem  ? this.extractParticipant(rem,  'rem')  : undefined

      const tax_regime = this.mapTaxRegime(emit.CRT)

      // Valor total da prestação
      const vPrest = (root.vPrest ?? {}) as Record<string, unknown>
      const total_value = toNumber(vPrest.vTPrest)

      // Tributos do documento (nível infCte.imp)
      const imp    = (root.imp ?? {}) as Record<string, unknown>
      const totals = this.extractTotals(imp, total_value)

      // Componentes do frete → itens
      const items = this.extractItems(vPrest, imp, cfop_doc, logs, filename)

      // Chaves NF-e referenciadas
      const referenced_keys = this.extractReferencedKeys(root)

      const document: FiscalDocument = {
        access_key,
        document_type: 'CTE',
        version,
        issue_date,
        purpose,
        tax_regime,
        issuer,
        receiver,
        sender,
        total_value,
        totals,
        items,
        referenced_keys: referenced_keys.length > 0 ? referenced_keys : undefined,
        status: logs.some((l) => l.level === 'WARN') ? 'PARTIAL' : 'VALID',
        source_filename: filename,
        raw_xml: xmlString,
      }

      return { document, logs, success: true }

    } catch (err) {
      return this.fatal(
        filename,
        `Erro no parsing CT-e: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // NAVEGAÇÃO
  // ---------------------------------------------------------------------------

  private getInfCte(parsed: Record<string, unknown>): Record<string, unknown> | null {
    // cteProc > CTe > infCte
    const viaProc = parsed.cteProc as Record<string, unknown> | undefined
    if (viaProc) {
      const cte = viaProc.CTe as Record<string, unknown> | undefined
      if (cte?.infCte) return cte.infCte as Record<string, unknown>
    }
    // CTe > infCte (avulso)
    const cte = parsed.CTe as Record<string, unknown> | undefined
    if (cte?.infCte) return cte.infCte as Record<string, unknown>
    return null
  }

  // ---------------------------------------------------------------------------
  // PARTICIPANTES
  // ---------------------------------------------------------------------------

  private extractParticipant(
    node: Record<string, unknown>,
    role: 'emit' | 'dest' | 'rem'
  ): Participant {
    const cnpj_cpf = String(node.CNPJ ?? node.CPF ?? '')
    const name     = String(node.xNome ?? node.xFant ?? '')
    const ie       = node.IE ? String(node.IE) : node.IM ? String(node.IM) : undefined

    const enderKey =
      role === 'emit' ? 'enderEmit' :
      role === 'dest' ? 'enderDest' : 'enderRem'
    const ender = (node[enderKey] ?? node.end ?? {}) as Record<string, unknown>
    const uf    = ender.UF ? String(ender.UF) : undefined

    return { cnpj_cpf, name, ie, uf }
  }

  private unknown(): Participant {
    return { cnpj_cpf: '', name: 'DESTINATÁRIO NÃO INFORMADO' }
  }

  // ---------------------------------------------------------------------------
  // TOTAIS
  // ---------------------------------------------------------------------------

  private extractTotals(imp: Record<string, unknown>, total_value: number): DocumentTotals {
    // ICMS no nível do documento
    const icmsNode  = imp.ICMS as Record<string, unknown> | undefined
    const icmsGroup = icmsNode
      ? (Object.values(icmsNode)[0] as Record<string, unknown> | undefined)
      : undefined

    // IBS/CBS no nível do documento
    const rtc = this.extractRtcFromImp(imp)

    return {
      vProd:     total_value,
      vTotTrib:  toNumber(imp.vTotTrib),
      vICMS:     icmsGroup ? toNumber(icmsGroup.vICMS) : 0,
      vBCIBSCBS: rtc.vBC,
      vIBS:      rtc.vIBS,
      vCBS:      rtc.vCBS,
    }
  }

  // ---------------------------------------------------------------------------
  // IBS/CBS DO CT-e (nível documento)
  // ---------------------------------------------------------------------------

  private extractRtcFromImp(imp: Record<string, unknown>): ItemTaxesRTC {
    const ibscbs = imp.IBSCBS as Record<string, unknown> | undefined
    if (!ibscbs) return {}

    const gIBSCBS = (ibscbs.gIBSCBS ?? {}) as Record<string, unknown>
    const gIBSUF  = (gIBSCBS.gIBSUF  ?? {}) as Record<string, unknown>
    const gIBSMun = (gIBSCBS.gIBSMun ?? {}) as Record<string, unknown>
    const gCBS    = (gIBSCBS.gCBS    ?? {}) as Record<string, unknown>

    return {
      cst:          String(ibscbs.CST         ?? '').padStart(3, '0'),
      c_class_trib: String(ibscbs.cClassTrib  ?? '').padStart(6, '0'),
      vBC:    toNumber(gIBSCBS.vBC),
      pIBSUF: toNumber(gIBSUF.pIBSUF),
      vIBSUF: toNumber(gIBSUF.vIBSUF),
      pIBSMun: toNumber(gIBSMun.pIBSMun),
      vIBSMun: toNumber(gIBSMun.vIBSMun),
      vIBS:   toNumber(gIBSCBS.vIBS),
      pCBS:   toNumber(gCBS.pCBS),
      vCBS:   toNumber(gCBS.vCBS),
    }
  }

  // ---------------------------------------------------------------------------
  // ITENS (Comp[])
  // ---------------------------------------------------------------------------

  private extractItems(
    vPrest: Record<string, unknown>,
    imp: Record<string, unknown>,
    cfop_doc: string,
    logs: ProcessingLog[],
    filename: string,
  ): DocumentItem[] {
    // ICMS do documento
    const icmsNode  = imp.ICMS as Record<string, unknown> | undefined
    const icmsGroup = icmsNode
      ? (Object.values(icmsNode)[0] as Record<string, unknown> | undefined)
      : undefined
    const taxesCurrent: ItemTaxesCurrent = icmsGroup
      ? {
          icms_cst:   String(icmsGroup.CST ?? icmsGroup.CSOSN ?? ''),
          icms_base:  toNumber(icmsGroup.vBC),
          icms_rate:  toNumber(icmsGroup.pICMS),
          icms_value: toNumber(icmsGroup.vICMS),
        }
      : {}

    // IBS/CBS do documento
    const rtcDoc = this.extractRtcFromImp(imp)

    // Componentes do frete
    const rawComp = vPrest.Comp
    const compArray: unknown[] = Array.isArray(rawComp)
      ? rawComp
      : rawComp !== undefined
      ? [rawComp]
      : []

    if (compArray.length === 0) {
      // Sem componentes: criar item sintético com o valor total
      logs.push(this.log('WARN', 'PARSE', filename, 'CT-e sem componentes Comp[]. Item sintético criado.'))
      const total = toNumber(vPrest.vTPrest)
      return [{
        item_number:   1,
        description:   'Frete',
        cfop:          cfop_doc,
        ncm:           'N/A',
        gross_value:   total,
        discount_value: 0,
        net_value:     total,
        taxes_current: taxesCurrent,
        rtc:           rtcDoc,
      }]
    }

    return compArray.map((comp, idx) => {
      const c = comp as Record<string, unknown>
      const gross = toNumber(c.vComp)
      return {
        item_number:   idx + 1,
        // item[0] recebe tributos do documento; demais ficam vazios
        description:   String(c.xNome ?? `Componente ${idx + 1}`),
        cfop:          cfop_doc,
        ncm:           'N/A',
        gross_value:   gross,
        discount_value: 0,
        net_value:     gross,
        taxes_current: idx === 0 ? taxesCurrent : {},
        rtc:           idx === 0 ? rtcDoc : {},
      }
    })
  }

  // ---------------------------------------------------------------------------
  // CHAVES NF-e REFERENCIADAS
  // ---------------------------------------------------------------------------

  private extractReferencedKeys(root: Record<string, unknown>): string[] {
    try {
      const norm  = root.infCTeNorm as Record<string, unknown> | undefined
      const doc   = norm?.infDoc   as Record<string, unknown> | undefined
      const infNFe = doc?.infNFe
      if (!infNFe) return []
      const arr: unknown[] = Array.isArray(infNFe) ? infNFe : [infNFe]
      return arr
        .map((n) => String((n as Record<string, unknown>).chave ?? ''))
        .filter(Boolean)
    } catch {
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // MAPEAMENTOS
  // ---------------------------------------------------------------------------

  private mapPurpose(tp: number): DocumentPurpose {
    const map: Record<number, DocumentPurpose> = {
      0: 'NORMAL', 1: 'COMPLEMENTAR', 2: 'ANULACAO', 3: 'SUBSTITUTO',
    }
    return map[tp] ?? 'UNKNOWN'
  }

  private mapTaxRegime(crt: unknown): TaxRegime {
    const n = Number(crt)
    if (n === 1 || n === 2) return 'SIMPLES_NACIONAL'
    if (n === 3) return 'RPA'
    return 'UNKNOWN'
  }

  // ---------------------------------------------------------------------------
  // UTILITÁRIOS
  // ---------------------------------------------------------------------------

  private fatal(filename: string, message: string): ParseResult {
    return {
      document: null,
      success: false,
      logs: [this.log('FATAL', 'PARSE', filename, message)],
    }
  }

  private log(
    level: ProcessingLog['level'],
    category: ProcessingLog['category'],
    source: string,
    message: string,
    detail?: string,
  ): ProcessingLog {
    return { timestamp: new Date().toISOString(), level, category, source, message, detail }
  }
}
