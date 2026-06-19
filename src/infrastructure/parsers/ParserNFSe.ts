/**
 * @file ParserNFSe.ts
 * @description Parser para NFS-e Nacional (SNNFSe/DPS) — padrão gov.br/nfse.
 * Versão 1.01 (schema NFSe-ESQUEMAS_XSD-v1.01-20260209).
 *
 * PADRÃO SUPORTADO: exclusivamente SNNFSe (namespace sped.fazenda.gov.br/nfse).
 * NFS-e ABRASF municipal → rejeitada no DocumentDetector (retorna UNKNOWN).
 *
 * ESTRUTURA REAL MAPEADA DA MASSA (258 arquivos):
 *
 *   infNFSe
 *     ├── emit          → issuer (xNome está AQUI, não dentro de DPS.prest)
 *     ├── valores       → ISS: vBC, pAliqAplic, vISSQN, vLiq
 *     ├── IBSCBS        → alíquotas e localidade de incidência
 *     │   └── totCIBS   → valores financeiros: gIBS.vIBSTot, gIBSUFTot.vIBSUF,
 *     │                    gIBSMunTot.vIBSMun, gCBS.vCBS
 *     └── DPS
 *           └── infDPS
 *                 ├── prest     → CNPJ, IM, regTrib.opSimpNac (SEM xNome)
 *                 ├── toma      → CNPJ, xNome, end
 *                 ├── serv      → cServ.cTribNac, cServ.xDescServ, locPrest
 *                 └── valores   → vServPrest.vServ, trib.tribMun, trib.tribFed.vRetIRRF...
 *
 * NOTA: IBSCBS da NFS-e não tem gIBSCBS por item — os valores financeiros estão
 * em infNFSe.IBSCBS.totCIBS (nível documento). A NFS-e representa 1 serviço por nota.
 */

import { XMLParser } from 'fast-xml-parser'
import type { IXmlParser } from './IXmlParser'
import type {
  ParseResult, FiscalDocument, DocumentItem,
  ItemTaxesCurrent, ItemTaxesRTC, DocumentTotals,
  Participant, TaxRegime, ProcessingLog,
} from '@/domain/models/FiscalDocument'
import { toNumber } from '@/lib/utils'

const XML_PARSER_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  /** Remove prefixos de namespace (ex: "nfse:NFSe" → "NFSe") */
  removeNSPrefix: true,
} as const

export class ParserNFSe implements IXmlParser {
  private readonly xmlParser = new XMLParser(XML_PARSER_CONFIG)

  parse(xmlString: string, filename: string): ParseResult {
    const logs: ProcessingLog[] = []

    try {
      const parsed = this.xmlParser.parse(xmlString)

      // Navegar até infNFSe
      const root = this.getInfNFSe(parsed)
      if (!root) {
        return this.fatal(filename, 'Nó infNFSe não encontrado. Verifique se é uma NFS-e Nacional válida (padrão SNNFSe).')
      }

      // DPS → infDPS
      const dps    = (root.DPS    ?? {}) as Record<string, unknown>
      const infDPS = (dps.infDPS  ?? {}) as Record<string, unknown>
      const prest  = (infDPS.prest ?? {}) as Record<string, unknown>
      const toma   = infDPS.toma   as Record<string, unknown> | undefined
      const serv   = (infDPS.serv  ?? {}) as Record<string, unknown>
      const cServ  = (serv.cServ   ?? {}) as Record<string, unknown>
      const locPrest = (serv.locPrest ?? {}) as Record<string, unknown>

      // Emit (nível infNFSe) — tem xNome; prest dentro de DPS não tem
      const emitNode = root.emit as Record<string, unknown> | undefined

      // Chave de acesso
      const rawId = String(root['@_Id'] ?? '')
      const nNFSe = String(root.nNFSe ?? '')
      const prestCNPJ = String(prest.CNPJ ?? prest.CPF ?? '')
      const access_key = rawId.replace(/^NFS[eE]/, '')
        || (prestCNPJ && nNFSe ? `${prestCNPJ}_${nNFSe}` : filename)

      const version    = String(root['@_versao'] ?? '1.01')

      // Data de emissão — em infDPS.dhEmi; data de competência em infDPS.dCompet
      const issue_date      = String(infDPS.dhEmi     ?? root.dhEmi ?? '')
      const competency_date = String(infDPS.dCompet   ?? '')

      // Prestador (issuer) — nome vem do emit, dados fiscais do prest
      const issuerName = emitNode ? String(emitNode.xNome ?? '') : ''
      const issuer: Participant = {
        cnpj_cpf: prestCNPJ,
        name:     issuerName,
        ie:       prest.IM ? String(prest.IM) : undefined,
        uf:       emitNode
          ? String((emitNode.enderNac as Record<string, unknown>)?.UF ?? '')
          : undefined,
      }

      // Tomador (receiver)
      const receiver = toma
        ? this.extractParticipant(toma)
        : { cnpj_cpf: '', name: 'TOMADOR NÃO INFORMADO' }

      // Regime tributário — opSimpNac dentro de prest.regTrib
      const regTrib = (prest.regTrib ?? {}) as Record<string, unknown>
      const tax_regime = this.mapTaxRegime(regTrib.opSimpNac)

      // Valores do documento (nível infNFSe.valores)
      const valoresDoc = (root.valores ?? {}) as Record<string, unknown>

      // Valores do DPS (nível infDPS.valores)
      const valoresDPS = (infDPS.valores ?? {}) as Record<string, unknown>
      const vServPrest = (valoresDPS.vServPrest ?? {}) as Record<string, unknown>
      const total_value = toNumber(vServPrest.vServ ?? valoresDoc.vBC)

      // Tributos
      const trib     = (valoresDPS.trib     ?? {}) as Record<string, unknown>
      const tribMun  = (trib.tribMun        ?? {}) as Record<string, unknown>
      const tribFed  = (trib.tribFed        ?? {}) as Record<string, unknown>
      const totTrib  = (trib.totTrib        ?? {}) as Record<string, unknown>
      const totTribV = (totTrib.vTotTrib    ?? {}) as Record<string, unknown>

      // IBSCBS (nível infNFSe) — totais financeiros em totCIBS
      const ibscbsNode = root.IBSCBS as Record<string, unknown> | undefined
      const totCIBS    = (ibscbsNode?.totCIBS ?? {}) as Record<string, unknown>
      const gIBS       = (totCIBS.gIBS        ?? {}) as Record<string, unknown>
      const gIBSUFTot  = (gIBS.gIBSUFTot     ?? {}) as Record<string, unknown>
      const gIBSMunTot = (gIBS.gIBSMunTot    ?? {}) as Record<string, unknown>
      const gCBS       = (totCIBS.gCBS        ?? {}) as Record<string, unknown>

      // Alíquotas IBSCBS (dentro de infNFSe.IBSCBS.valores)
      const ibscbsValores = (ibscbsNode?.valores   ?? {}) as Record<string, unknown>
      const ibscbsUF      = (ibscbsValores.uf      ?? {}) as Record<string, unknown>
      const ibscbsMun     = (ibscbsValores.mun     ?? {}) as Record<string, unknown>
      const ibscbsFed     = (ibscbsValores.fed      ?? {}) as Record<string, unknown>

      // Totais do documento
      const totals: DocumentTotals = {
        vProd:     total_value,
        vTotTrib:  toNumber(totTribV.vTotTribFed) + toNumber(totTribV.vTotTribMun),
        vISS:      toNumber(valoresDoc.vISSQN),
        vISSRet:   Number(tribMun.tpRetISSQN) === 2 ? toNumber(valoresDoc.vISSQN) : 0,
        vBCIBSCBS: toNumber(ibscbsValores.vBC ?? valoresDoc.vBC),
        vIBS:      toNumber(gIBS.vIBSTot),
        vCBS:      toNumber(gCBS.vCBS),
      }

      // Código tributação nacional do serviço
      const cTribNac  = String(cServ.cTribNac ?? '')
      const xDescServ = String(cServ.xDescServ ?? '')
      const cLocPrest = String(locPrest.cLocPrestacao ?? '')

      // Tributos legados do item
      const taxesCurrent: ItemTaxesCurrent = {
        iss_base:     toNumber(valoresDoc.vBC),
        iss_rate:     toNumber(valoresDoc.pAliqAplic),
        iss_value:    toNumber(valoresDoc.vISSQN),
        iss_retained: Number(tribMun.tpRetISSQN) === 2,
        ir_value:     toNumber(tribFed.vRetIRRF),
        csll_value:   toNumber(tribFed.vRetCSLL),
        inss_value:   toNumber(tribFed.vRetINSS),
        pis_value:    toNumber(tribFed.vRetPIS),
        cofins_value: toNumber(tribFed.vRetCOFINS),
      }

      // IBS/CBS do item (NFS-e tem 1 serviço = 1 item)
      const rtc: ItemTaxesRTC = ibscbsNode ? {
        vBC:     toNumber(ibscbsValores.vBC),
        pIBSUF:  toNumber(ibscbsUF.pIBSUF),
        vIBSUF:  toNumber(gIBSUFTot.vIBSUF),
        pIBSMun: toNumber(ibscbsMun.pIBSMun),
        vIBSMun: toNumber(gIBSMunTot.vIBSMun),
        vIBS:    toNumber(gIBS.vIBSTot),
        pCBS:    toNumber(ibscbsFed.pCBS),
        vCBS:    toNumber(gCBS.vCBS),
      } : {}

      const item: DocumentItem = {
        item_number:    1,
        description:    xDescServ || 'Serviço não descrito',
        cfop:           cTribNac,   // Código NBS — substitui CFOP na NFS-e
        ncm:            cLocPrest,  // Código município — substitui NCM na NFS-e
        gross_value:    total_value,
        discount_value: 0,
        net_value:      total_value,
        taxes_current:  taxesCurrent,
        rtc,
      }

      const document: FiscalDocument = {
        access_key,
        document_type:    'NFSE',
        version,
        issue_date,
        competency_date:  competency_date || undefined,
        purpose:          'NORMAL',
        tax_regime,
        issuer,
        receiver,
        total_value,
        totals,
        items:            [item],
        municipality_code: cLocPrest || undefined,
        status:           logs.some((l) => l.level === 'WARN') ? 'PARTIAL' : 'VALID',
        source_filename:  filename,
        raw_xml:          xmlString,
      }

      return { document, logs, success: true }

    } catch (err) {
      return this.fatal(
        filename,
        `Erro no parsing NFS-e: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // NAVEGAÇÃO
  // ---------------------------------------------------------------------------

  private getInfNFSe(parsed: Record<string, unknown>): Record<string, unknown> | null {
    // NFSe > infNFSe  (padrão nacional)
    const nfse = parsed.NFSe as Record<string, unknown> | undefined
    if (nfse?.infNFSe) return nfse.infNFSe as Record<string, unknown>
    // Fallback: infNFSe direto (sem wrapper)
    if (parsed.infNFSe) return parsed.infNFSe as Record<string, unknown>
    return null
  }

  // ---------------------------------------------------------------------------
  // PARTICIPANTES
  // ---------------------------------------------------------------------------

  private extractParticipant(node: Record<string, unknown>): Participant {
    const cnpj_cpf = String(
      (node.CNPJ ?? (node.CPF as unknown) ??
       ((node.CpfCnpj as Record<string, unknown>)?.Cnpj) ??
       ((node.CpfCnpj as Record<string, unknown>)?.Cpf) ?? '')
    )
    const name = String(node.xNome ?? node.RazaoSocial ?? '')
    const ie   = node.IM ? String(node.IM) : undefined

    const endNode = (node.end ?? node.enderNac ?? {}) as Record<string, unknown>
    const endNac  = (endNode.endNac ?? endNode) as Record<string, unknown>
    const uf = String(endNac.UF ?? endNode.UF ?? '')

    return { cnpj_cpf, name, ie, uf: uf || undefined }
  }

  // ---------------------------------------------------------------------------
  // MAPEAMENTOS
  // ---------------------------------------------------------------------------

  private mapTaxRegime(opSimpNac: unknown): TaxRegime {
    const n = Number(opSimpNac)
    if (n === 0) return 'RPA'
    if (n === 1 || n === 2 || n === 3) return 'SIMPLES_NACIONAL'
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
