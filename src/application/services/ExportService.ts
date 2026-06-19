/**
 * @file ExportService.ts
 * @description Exportação client-side para Excel (XLSX) e CSV.
 *
 * LGPD: todo o processamento acontece no browser do usuário.
 * Nenhum dado é transmitido a servidores externos.
 *
 * ESTRUTURA EXCEL (2 abas):
 *   Aba 1 "Documentos"     — visão por cabeçalho (1 linha por documento)
 *   Aba 2 "Itens Analítico"— desnormalizado por item (pronto para Pivot Table)
 *                            com ênfase nos campos da Reforma Tributária
 */

import type { FiscalDocument } from '@/domain/models/FiscalDocument'
import { formatBRL, formatCnpjCpf } from '@/lib/utils'

// ---------------------------------------------------------------------------
// EXCEL
// ---------------------------------------------------------------------------

/** Gera e dispara o download do arquivo Excel. */
export async function exportToExcel(
  documents: FiscalDocument[],
  filename?: string,
): Promise<void> {
  // Importação dinâmica — não bloqueia o bundle principal
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // --- Aba 1: Documentos (cabeçalho) ---
  const sheet1 = buildDocumentSheet(documents)
  const ws1 = XLSX.utils.json_to_sheet(sheet1)
  applyColumnWidths(ws1, [
    { wch: 46 }, // Chave
    { wch: 7  }, // Tipo
    { wch: 8  }, // Direção
    { wch: 14 }, // Finalidade
    { wch: 18 }, // Data
    { wch: 18 }, // CNPJ Emitente
    { wch: 32 }, // Nome Emitente
    { wch: 18 }, // CNPJ Dest.
    { wch: 32 }, // Nome Dest.
    { wch: 10 }, // Regime
    { wch: 14 }, // Valor Total
    { wch: 8  }, // Status
    { wch: 14 }, // Base IBS/CBS
    { wch: 12 }, // Total IBS
    { wch: 12 }, // Total CBS
    { wch: 12 }, // Saldo
  ])
  XLSX.utils.book_append_sheet(wb, ws1, 'Documentos')

  // --- Aba 2: Itens Analítico ---
  const sheet2 = buildItemSheet(documents)
  const ws2 = XLSX.utils.json_to_sheet(sheet2)
  XLSX.utils.book_append_sheet(wb, ws2, 'Itens Analítico')

  const fname = filename ?? `apuracao-rtc-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fname)
}

// ---------------------------------------------------------------------------
// CONSTRUTORES DAS ABAS
// ---------------------------------------------------------------------------

function buildDocumentSheet(documents: FiscalDocument[]): Record<string, unknown>[] {
  return documents.map(doc => {
    const vIBS    = doc.totals.vIBS ?? 0
    const vCBS    = doc.totals.vCBS ?? 0

    return {
      'Chave de Acesso':    doc.access_key,
      'Tipo':               doc.document_type,
      'Direção':            doc.direction ?? 'NÃO ENRIQUECIDO',
      'Finalidade':         doc.purpose,
      'Data Emissão':       formatDate(doc.issue_date),
      'Emitente CNPJ':      formatCnpjCpf(doc.issuer.cnpj_cpf),
      'Emitente Nome':      doc.issuer.name,
      'Destinatário CNPJ':  formatCnpjCpf(doc.receiver.cnpj_cpf),
      'Destinatário Nome':  doc.receiver.name,
      'Regime':             doc.tax_regime,
      'Valor Total (R$)':   doc.total_value,
      'Status':             doc.status,
      '[RTC] Base IBS/CBS': doc.totals.vBCIBSCBS ?? 0,
      '[RTC] Total IBS':    vIBS,
      '[RTC] Total CBS':    vCBS,
      '[RTC] Saldo':        vIBS + vCBS,
    }
  })
}

function buildItemSheet(documents: FiscalDocument[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  for (const doc of documents) {
    // Campos de cabeçalho repetidos em cada item (facilita filtros no Excel)
    const header = {
      'Chave de Acesso':   doc.access_key,
      'Tipo Doc':          doc.document_type,
      'Direção':           doc.direction ?? '',
      'Data Emissão':      formatDate(doc.issue_date),
      'Emitente CNPJ':     formatCnpjCpf(doc.issuer.cnpj_cpf),
      'Emitente Nome':     doc.issuer.name,
      'Destinatário CNPJ': formatCnpjCpf(doc.receiver.cnpj_cpf),
      'Destinatário Nome': doc.receiver.name,
      'Regime':            doc.tax_regime,
    }

    for (const item of doc.items) {
      rows.push({
        ...header,
        // Item
        'Nº Item':           item.item_number,
        'Descrição':         item.description,
        'CFOP':              item.cfop,
        'NCM':               item.ncm,
        'Valor Bruto (R$)':  item.gross_value,
        'Desconto (R$)':     item.discount_value,
        'Valor Líquido (R$)': item.net_value,
        // Impacto RTC
        'Impacto RTC':       item.rtc_impact ?? 'NÃO CALCULADO',
        // Campos da Reforma Tributária
        '[RTC] CST':              item.rtc.cst              ?? '',
        '[RTC] cClassTrib':       item.rtc.c_class_trib     ?? '',
        '[RTC] Base Cálc (R$)':   item.rtc.vBC              ?? 0,
        '[RTC] Alíq IBS UF (%)':  item.rtc.pIBSUF           ?? 0,
        '[RTC] Valor IBS UF':     item.rtc.vIBSUF           ?? 0,
        '[RTC] Alíq IBS Mun (%)': item.rtc.pIBSMun          ?? 0,
        '[RTC] Valor IBS Mun':    item.rtc.vIBSMun          ?? 0,
        '[RTC] Valor IBS Total':  item.rtc.vIBS             ?? 0,
        '[RTC] Alíq CBS (%)':     item.rtc.pCBS             ?? 0,
        '[RTC] Valor CBS':        item.rtc.vCBS             ?? 0,
        // Tributos legados (resumo)
        'ICMS CST':    item.taxes_current.icms_cst    ?? '',
        'ICMS Valor':  item.taxes_current.icms_value  ?? 0,
        'PIS CST':     item.taxes_current.pis_cst     ?? '',
        'PIS Valor':   item.taxes_current.pis_value   ?? 0,
        'COFINS CST':  item.taxes_current.cofins_cst  ?? '',
        'COFINS Valor':item.taxes_current.cofins_value ?? 0,
        // ISS (NFS-e)
        'ISS Base':    item.taxes_current.iss_base    ?? 0,
        'ISS Alíq (%)':item.taxes_current.iss_rate   ?? 0,
        'ISS Valor':   item.taxes_current.iss_value   ?? 0,
      })
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// CSV — relatório de inconformidades
// ---------------------------------------------------------------------------

/** Gera e dispara o download do CSV de inconformidades. */
export function exportInconformesToCsv(
  documents: FiscalDocument[],
  filename?: string,
): void {
  const rows = documents.map(doc => [
    doc.access_key,
    doc.document_type,
    formatDate(doc.issue_date),
    formatCnpjCpf(doc.issuer.cnpj_cpf),
    `"${doc.issuer.name}"`,
    doc.tax_regime,
    formatBRL(doc.total_value),
    String(doc.totals.vIBS ?? 0),
    String(doc.totals.vCBS ?? 0),
  ])

  const header = [
    'Chave de Acesso','Tipo','Data Emissão','Emitente CNPJ','Emitente Nome',
    'Regime','Valor Total','IBS','CBS',
  ]

  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename ?? `inconformes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS INTERNOS
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function applyColumnWidths(ws: Record<string, unknown>, widths: { wch: number }[]) {
  ws['!cols'] = widths
}
