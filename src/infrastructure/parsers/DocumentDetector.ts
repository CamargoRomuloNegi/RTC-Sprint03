/**
 * @file DocumentDetector.ts
 * @description Detecta o tipo de um documento fiscal a partir do XML bruto.
 *
 * ESTRATÉGIA DE DETECÇÃO (em ordem de prioridade):
 * 1. Regex rápida na string XML — evita parse completo desnecessário
 * 2. Para NFe/NFCe: extração do campo <mod> para distinguir modelo 55 de 65
 * 3. NFS-e: exige namespace gov.br — rejeita padrões ABRASF municipais
 *
 * DECISÃO DE DESIGN: Detecção é feita por regex, não por parse completo.
 * Motivo: performance em lotes grandes (centenas de XMLs).
 * O parse completo fica a cargo do parser específico.
 */

import type { DocumentType, ProcessingLog } from '@/domain/models/FiscalDocument'

export interface DetectionResult {
  type: DocumentType
  logs: ProcessingLog[]
}

/** Regexes compiladas uma vez para performance em lotes */
const REGEX = {
  /** NF-e ou NFC-e — detecta o nó raiz */
  nfe: /<nfeProc[\s>]/i,
  nfeAvulsa: /<NFe[\s>]/i,
  /** CT-e */
  cte: /<cteProc[\s>]/i,
  cteAvulso: /<CTe[\s>]/i,
  /** NFS-e Nacional — exige namespace SPED Fazenda */
  nfseNacional: /sped\.fazenda\.gov\.br\/nfse/i,
  /** Padrão ABRASF municipal — rejeitado explicitamente */
  nfseAbrasf: /<CompNfse[\s>]|<Nfse[\s>](?!.*sped\.fazenda)/i,
  /** Extrai o valor do campo <mod> dentro de <ide> */
  modNF: /<mod>(\d+)<\/mod>/,
} as const

/**
 * Detecta o tipo de documento fiscal de um XML bruto.
 * Operação síncrona e de baixo custo computacional.
 */
export function detectDocumentType(xmlString: string, filename: string): DetectionResult {
  const logs: ProcessingLog[] = []

  const now = new Date().toISOString()

  // --- NFS-e Nacional (SNNFSe/DPS) ---
  if (REGEX.nfseNacional.test(xmlString)) {
    logs.push({
      timestamp: now,
      level: 'INFO',
      category: 'DETECTION',
      source: filename,
      message: 'Documento identificado como NFS-e Nacional (SNNFSe)',
    })
    return { type: 'NFSE', logs }
  }

  // --- Rejeição explícita de NFS-e padrão ABRASF ---
  if (REGEX.nfseAbrasf.test(xmlString)) {
    logs.push({
      timestamp: now,
      level: 'WARN',
      category: 'DETECTION',
      source: filename,
      message:
        'Documento identificado como NFS-e no padrão ABRASF municipal, que não é suportado. ' +
        'Utilize o padrão nacional SNNFSe (gov.br/nfse).',
      detail: 'Padrão detectado: CompNfse ou Nfse sem namespace sped.fazenda.gov.br',
    })
    return { type: 'UNKNOWN', logs }
  }

  // --- CT-e ---
  if (REGEX.cte.test(xmlString) || REGEX.cteAvulso.test(xmlString)) {
    logs.push({
      timestamp: now,
      level: 'INFO',
      category: 'DETECTION',
      source: filename,
      message: 'Documento identificado como CT-e (Modelo 57)',
    })
    return { type: 'CTE', logs }
  }

  // --- NF-e ou NFC-e — diferencia pelo campo <mod> ---
  if (REGEX.nfe.test(xmlString) || REGEX.nfeAvulsa.test(xmlString)) {
    const modMatch = REGEX.modNF.exec(xmlString)

    if (!modMatch) {
      // XML parece NF-e mas não tem o campo <mod> — retorna NFE como fallback
      logs.push({
        timestamp: now,
        level: 'WARN',
        category: 'DETECTION',
        source: filename,
        message: 'Documento identificado como NF-e, mas o campo <mod> não foi encontrado. Assumindo Modelo 55.',
        detail: 'Campo ide.mod ausente no XML',
      })
      return { type: 'NFE', logs }
    }

    const mod = modMatch[1]

    if (mod === '65') {
      logs.push({
        timestamp: now,
        level: 'INFO',
        category: 'DETECTION',
        source: filename,
        message: 'Documento identificado como NFC-e (Modelo 65)',
      })
      return { type: 'NFCE', logs }
    }

    if (mod === '55') {
      logs.push({
        timestamp: now,
        level: 'INFO',
        category: 'DETECTION',
        source: filename,
        message: 'Documento identificado como NF-e (Modelo 55)',
      })
      return { type: 'NFE', logs }
    }

    // Modelo desconhecido
    logs.push({
      timestamp: now,
      level: 'ERROR',
      category: 'DETECTION',
      source: filename,
      message: `Modelo de NF-e desconhecido: ${mod}. Documento ignorado.`,
      detail: `Modelos suportados: 55 (NF-e), 65 (NFC-e)`,
    })
    return { type: 'UNKNOWN', logs }
  }

  // --- Não identificado ---
  logs.push({
    timestamp: now,
    level: 'ERROR',
    category: 'DETECTION',
    source: filename,
    message: 'Tipo de documento não reconhecido. O arquivo pode não ser um XML fiscal válido.',
    detail: 'Nenhum dos padrões esperados foi encontrado: nfeProc, NFe, cteProc, CTe, NFSe (gov.br)',
  })
  return { type: 'UNKNOWN', logs }
}
