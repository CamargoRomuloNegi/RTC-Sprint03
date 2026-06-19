/**
 * @file ParserNFe.ts
 * @description Parser completo para NF-e (Modelo 55) e base para NFC-e (Modelo 65).
 * Leiaute 4.00 — SEFAZ/RFB.
 *
 * Cobre:
 * - Regimes CRT 1, 2 (Simples/MEI) e 3 (RPA)
 * - IBSCBS presente (RPA 2026+) e ausente (Simples / período pré-reforma)
 * - Todos os grupos ICMS: ICMS00, ICMS10, ICMS20, ICMS40, ICMS45, ICMS51,
 *   ICMS60, ICMS70, ICMS90, ICMSSN102, ICMSSN202, ICMSSN500, ICMSSN900
 * - PIS/COFINS: PISAliq, PISQtde, PISNT, PISoutr / COFINSAliq, COFINSQtde, COFINSNT, COFINSoutr
 * - IPI: IPITrib, IPINT
 * - Múltiplos itens (det[]) — array sempre forçado
 * - Notas de devolução (finNFe=4), complementar (2), ajuste (3)
 */

import { XMLParser } from 'fast-xml-parser'
import type { IXmlParser } from './IXmlParser'
import type {
  ParseResult, FiscalDocument, DocumentItem,
  ItemTaxesCurrent, ItemTaxesRTC, DocumentTotals,
  Participant, DocumentType, TaxRegime, DocumentPurpose,
  ProcessingLog,
} from '@/domain/models/FiscalDocument'
import { toNumber } from '@/lib/utils'

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO PARSER XML
// ---------------------------------------------------------------------------

const XML_PARSER_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  /** Força array para `det` mesmo com 1 único item — crítico */
  isArray: (name: string) => name === 'det',
} as const

// ---------------------------------------------------------------------------
// PARSER
// ---------------------------------------------------------------------------

export class ParserNFe implements IXmlParser {
  protected readonly xmlParser = new XMLParser(XML_PARSER_CONFIG)
  /** Subtipo pode ser sobrescrito por ParserNFCe */
  protected readonly docType: DocumentType = 'NFE'

  parse(xmlString: string, filename: string): ParseResult {
    const logs: ProcessingLog[] = []

    try {
      const parsed = this.xmlParser.parse(xmlString)

      // Navegar até infNFe — suporta XML com e sem protocolo
      const root = this.getInfNFe(parsed)
      if (!root) {
        return this.fatal(filename, 'Nó infNFe não encontrado. Verifique se é um XML NF-e válido.')
      }

      const ide = (root.ide ?? {}) as Record<string, unknown>
      const emit = (root.emit ?? {}) as Record<string, unknown>
      const dest = root.dest as Record<string, unknown> | undefined
      const totalNode = (root.total ?? {}) as Record<string, unknown>

      // Chave de acesso
      const rawId = String(root['@_Id'] ?? '')
      const access_key = rawId.replace(/^NFe/, '') || filename

      // Detectar versão e data
      const version = String(root['@_versao'] ?? '4.00')
      const issue_date = String(ide.dhEmi ?? '')

      // Participantes
      const issuer = this.extractParticipant(emit, 'emit')
      const receiver = dest
        ? this.extractParticipant(dest, 'dest')
        : this.consumidorFinal()

      // Regime e finalidade
      const tax_regime = this.mapTaxRegime(emit.CRT)
      const purpose = this.mapPurpose(Number(ide.finNFe ?? 1))

      // Totais
      const totals = this.extractTotals(totalNode)
      const total_value = toNumber(
        (totalNode.ICMSTot as Record<string, unknown>)?.vNF ?? 0
      )

      // Itens — det[] sempre array (isArray configurado)
      const rawDets = root.det
      const detArray: unknown[] = Array.isArray(rawDets)
        ? rawDets
        : rawDets !== undefined
        ? [rawDets]
        : []

      const items: DocumentItem[] = detArray.map((det) =>
        this.extractItem(det as Record<string, unknown>)
      )

      if (items.length === 0) {
        logs.push(this.log('WARN', 'PARSE', filename, 'Nenhum item (det) encontrado no documento.'))
      }

      const document: FiscalDocument = {
        access_key,
        document_type: this.docType,
        version,
        issue_date,
        purpose,
        tax_regime,
        issuer,
        receiver,
        total_value,
        totals,
        items,
        status: logs.some((l) => l.level === 'WARN') ? 'PARTIAL' : 'VALID',
        source_filename: filename,
        raw_xml: xmlString,
      }

      return { document, logs, success: true }

    } catch (err) {
      return this.fatal(
        filename,
        `Erro inesperado no parsing: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // NAVEGAÇÃO NO XML
  // ---------------------------------------------------------------------------

  protected getInfNFe(parsed: Record<string, unknown>): Record<string, unknown> | null {
    // nfeProc > NFe > infNFe  (com protocolo — mais comum)
    const viaProc = (parsed.nfeProc as Record<string, unknown>)
    if (viaProc) {
      const nfe = viaProc.NFe as Record<string, unknown>
      if (nfe?.infNFe) return nfe.infNFe as Record<string, unknown>
    }
    // NFe > infNFe  (XML avulso)
    const nfe = parsed.NFe as Record<string, unknown>
    if (nfe?.infNFe) return nfe.infNFe as Record<string, unknown>
    return null
  }

  // ---------------------------------------------------------------------------
  // PARTICIPANTES
  // ---------------------------------------------------------------------------

  protected extractParticipant(
    node: Record<string, unknown>,
    role: 'emit' | 'dest' | 'rem'
  ): Participant {
    const cnpj_cpf = String(node.CNPJ ?? node.CPF ?? '')
    const name = String(node.xNome ?? node.xFant ?? '')
    const ie = node.IE ? String(node.IE) : node.IM ? String(node.IM) : undefined

    const enderKey =
      role === 'emit' ? 'enderEmit' :
      role === 'dest' ? 'enderDest' : 'enderRem'
    const ender = (node[enderKey] ?? node.end ?? {}) as Record<string, unknown>
    const uf = ender.UF ? String(ender.UF) : undefined

    return { cnpj_cpf, name, ie, uf }
  }

  protected consumidorFinal(): Participant {
    return { cnpj_cpf: 'CONSUMIDOR_FINAL', name: 'CONSUMIDOR FINAL' }
  }

  // ---------------------------------------------------------------------------
  // TOTAIS
  // ---------------------------------------------------------------------------

  protected extractTotals(totalNode: Record<string, unknown>): DocumentTotals {
    const icms = (totalNode.ICMSTot ?? {}) as Record<string, unknown>
    const ibscbsTot = (totalNode.IBSCBSTot ?? {}) as Record<string, unknown>
    // Estrutura real: IBSCBSTot.gIBS.vIBS (total) e gIBS.gIBSUF.vIBSUF, gCBS.vCBS
    const gIBS = (ibscbsTot.gIBS ?? {}) as Record<string, unknown>
    const gCBS = (ibscbsTot.gCBS ?? {}) as Record<string, unknown>

    return {
      vProd:     toNumber(icms.vProd),
      vDesc:     toNumber(icms.vDesc),
      vFrete:    toNumber(icms.vFrete),
      vSeg:      toNumber(icms.vSeg),
      vOutro:    toNumber(icms.vOutro),
      vTotTrib:  toNumber(icms.vTotTrib),
      vICMS:     toNumber(icms.vICMS),
      vPIS:      toNumber(icms.vPIS),
      vCOFINS:   toNumber(icms.vCOFINS),
      vBCIBSCBS: toNumber(ibscbsTot.vBCIBSCBS),
      vIBS:      toNumber(gIBS.vIBS),
      vCBS:      toNumber(gCBS.vCBS),
    }
  }

  // ---------------------------------------------------------------------------
  // ITENS
  // ---------------------------------------------------------------------------

  protected extractItem(det: Record<string, unknown>): DocumentItem {
    const prod = (det.prod ?? {}) as Record<string, unknown>
    const imposto = (det.imposto ?? {}) as Record<string, unknown>

    const gross_value = toNumber(prod.vProd)
    const discount_value = toNumber(prod.vDesc)

    return {
      item_number:   Number(det['@_nItem'] ?? 0),
      description:   String(prod.xProd ?? ''),
      cfop:          String(prod.CFOP ?? ''),
      ncm:           String(prod.NCM ?? ''),
      gross_value,
      discount_value,
      net_value:     gross_value - discount_value,
      taxes_current: this.extractTaxesCurrent(imposto),
      rtc:           this.extractRtc(imposto),
    }
  }

  // ---------------------------------------------------------------------------
  // TRIBUTOS LEGADOS
  // ---------------------------------------------------------------------------

  protected extractTaxesCurrent(imposto: Record<string, unknown>): ItemTaxesCurrent {
    const result: ItemTaxesCurrent = {}

    // ICMS — múltiplos grupos possíveis, pega o primeiro filho
    const icmsNode = imposto.ICMS as Record<string, unknown> | undefined
    if (icmsNode) {
      const icmsGroup = Object.values(icmsNode)[0] as Record<string, unknown> | undefined
      if (icmsGroup && typeof icmsGroup === 'object') {
        result.icms_cst   = String(icmsGroup.CST ?? icmsGroup.CSOSN ?? '')
        result.icms_base  = toNumber(icmsGroup.vBC)
        result.icms_rate  = toNumber(icmsGroup.pICMS)
        result.icms_value = toNumber(icmsGroup.vICMS)
      }
    }

    // PIS — PISAliq, PISQtde, PISNT, PISoutr
    const pisNode = imposto.PIS as Record<string, unknown> | undefined
    if (pisNode) {
      const pisGroup = Object.values(pisNode)[0] as Record<string, unknown> | undefined
      if (pisGroup && typeof pisGroup === 'object') {
        result.pis_cst   = String(pisGroup.CST ?? '')
        result.pis_base  = toNumber(pisGroup.vBC)
        result.pis_rate  = toNumber(pisGroup.pPIS)
        result.pis_value = toNumber(pisGroup.vPIS)
      }
    }

    // COFINS — COFINSAliq, COFINSQtde, COFINSNT, COFINSoutr
    const cofinsNode = imposto.COFINS as Record<string, unknown> | undefined
    if (cofinsNode) {
      const cofinsGroup = Object.values(cofinsNode)[0] as Record<string, unknown> | undefined
      if (cofinsGroup && typeof cofinsGroup === 'object') {
        result.cofins_cst   = String(cofinsGroup.CST ?? '')
        result.cofins_base  = toNumber(cofinsGroup.vBC)
        result.cofins_rate  = toNumber(cofinsGroup.pCOFINS)
        result.cofins_value = toNumber(cofinsGroup.vCOFINS)
      }
    }

    // IPI — IPITrib, IPINT (opcional — somente industrializados)
    const ipiNode = imposto.IPI as Record<string, unknown> | undefined
    if (ipiNode) {
      const ipiGroup = (ipiNode.IPITrib ?? ipiNode.IPINT) as Record<string, unknown> | undefined
      if (ipiGroup && typeof ipiGroup === 'object') {
        result.ipi_cst   = String(ipiGroup.CST ?? '')
        result.ipi_base  = toNumber(ipiGroup.vBC)
        result.ipi_rate  = toNumber(ipiGroup.pIPI)
        result.ipi_value = toNumber(ipiGroup.vIPI)
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // IBS/CBS (REFORMA TRIBUTÁRIA)
  // ---------------------------------------------------------------------------

  protected extractRtc(imposto: Record<string, unknown>): ItemTaxesRTC {
    const ibscbs = imposto.IBSCBS as Record<string, unknown> | undefined
    if (!ibscbs) return {}

    const gIBSCBS = (ibscbs.gIBSCBS ?? {}) as Record<string, unknown>
    const gIBSUF  = (gIBSCBS.gIBSUF  ?? {}) as Record<string, unknown>
    const gIBSMun = (gIBSCBS.gIBSMun ?? {}) as Record<string, unknown>
    const gCBS    = (gIBSCBS.gCBS    ?? {}) as Record<string, unknown>

    return {
      cst:         String(ibscbs.CST ?? '').padStart(3, '0'),
      c_class_trib: String(ibscbs.cClassTrib ?? '').padStart(6, '0'),
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
  // MAPEAMENTOS
  // ---------------------------------------------------------------------------

  protected mapPurpose(fin: number): DocumentPurpose {
    const map: Record<number, DocumentPurpose> = {
      1: 'NORMAL', 2: 'COMPLEMENTAR', 3: 'AJUSTE', 4: 'DEVOLUCAO',
    }
    return map[fin] ?? 'UNKNOWN'
  }

  protected mapTaxRegime(crt: unknown): TaxRegime {
    const n = Number(crt)
    if (n === 1 || n === 2) return 'SIMPLES_NACIONAL'
    if (n === 3) return 'RPA'
    return 'UNKNOWN'
  }

  // ---------------------------------------------------------------------------
  // UTILITÁRIOS
  // ---------------------------------------------------------------------------

  protected fatal(filename: string, message: string): ParseResult {
    return {
      document: null,
      success: false,
      logs: [this.log('FATAL', 'PARSE', filename, message)],
    }
  }

  protected log(
    level: ProcessingLog['level'],
    category: ProcessingLog['category'],
    source: string,
    message: string,
    detail?: string,
  ): ProcessingLog {
    return { timestamp: new Date().toISOString(), level, category, source, message, detail }
  }
}
