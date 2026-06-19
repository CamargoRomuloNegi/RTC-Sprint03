/**
 * @file FiscalDocument.ts
 * @description Entidades e tipos centrais do domínio fiscal.
 * Cobre os 4 tipos de documento: NF-e (55), NFC-e (65), CT-e (57) e NFS-e Nacional.
 *
 * REGRA: Este arquivo não importa nada de fora do domínio.
 * É a camada mais interna da arquitetura — zero dependências externas.
 */

// ---------------------------------------------------------------------------
// ENUMERAÇÕES
// ---------------------------------------------------------------------------

/** Tipos de documento fiscal suportados pelo sistema */
export type DocumentType = 'NFE' | 'NFCE' | 'CTE' | 'NFSE' | 'UNKNOWN'

/**
 * Regime tributário do emitente.
 * Fonte NF-e/CT-e: campo CRT (1/2=Simples, 3=RPA).
 * Fonte NFS-e Nacional: campo opSimpNac (0=RPA, 1=MEI, 2=SN, 3=SN-Excesso).
 */
export type TaxRegime = 'SIMPLES_NACIONAL' | 'MEI' | 'RPA' | 'UNKNOWN'

/** Status do processamento do documento */
export type DocumentStatus = 'VALID' | 'SCHEMA_ERROR' | 'PARTIAL'

/**
 * Direção da operação em relação à empresa analisada.
 * Inferida pela comparação do CNPJ raiz com emitente/destinatário.
 * INBOUND = entrada (potencial crédito de IBS/CBS)
 * OUTBOUND = saída (potencial débito de IBS/CBS)
 */
export type DocumentDirection = 'INBOUND' | 'OUTBOUND' | 'UNKNOWN'

/**
 * Finalidade do documento.
 * NF-e: finNFe (1-4) | CT-e: finCTe (0-3) | NFS-e: sem finalidade
 */
export type DocumentPurpose =
  | 'NORMAL'
  | 'COMPLEMENTAR'
  | 'AJUSTE'
  | 'DEVOLUCAO'
  | 'ANULACAO'
  | 'SUBSTITUTO'
  | 'UNKNOWN'

/**
 * Impacto tributário do item na apuração RTC.
 * Determinado pela DIREÇÃO, não pelo CFOP.
 * CFOP é usado apenas para filtrar operações não-comerciais (NEUTRAL).
 */
export type RtcImpact = 'CREDIT' | 'DEBIT' | 'NEUTRAL'

/** Nível de severidade do log de processamento */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

/** Categoria do erro no log */
export type LogCategory = 'DETECTION' | 'SCHEMA' | 'PARSE' | 'BUSINESS_RULE' | 'EXPORT'

// ---------------------------------------------------------------------------
// PARTICIPANTES
// ---------------------------------------------------------------------------

/**
 * Representa um participante de um documento fiscal
 * (emitente, destinatário, remetente, tomador, prestador, etc.)
 */
export interface Participant {
  /** CNPJ (14 dígitos) ou CPF (11 dígitos), somente números */
  cnpj_cpf: string
  /** Razão social ou nome */
  name: string
  /** Inscrição Estadual ou Municipal (NFS-e) */
  ie?: string
  /** UF de endereço */
  uf?: string
}

// ---------------------------------------------------------------------------
// TRIBUTOS LEGADOS (por item)
// ---------------------------------------------------------------------------

/**
 * Tributos do sistema tributário atual (pré-reforma) por item.
 * NF-e/NFC-e: ICMS, PIS, COFINS, IPI.
 * CT-e: ICMS (nível documento, atribuído ao item[0]).
 * NFS-e: ISS + retenções federais.
 */
export interface ItemTaxesCurrent {
  // --- ICMS (NF-e, NFC-e, CT-e) ---
  icms_cst?: string
  icms_base?: number
  icms_rate?: number
  icms_value?: number

  // --- PIS (NF-e, NFC-e) ---
  pis_cst?: string
  pis_base?: number
  pis_rate?: number
  pis_value?: number

  // --- COFINS (NF-e, NFC-e) ---
  cofins_cst?: string
  cofins_base?: number
  cofins_rate?: number
  cofins_value?: number

  // --- IPI (somente NF-e produtos industrializados) ---
  ipi_cst?: string
  ipi_base?: number
  ipi_rate?: number
  ipi_value?: number

  // --- ISS (somente NFS-e) ---
  /** Base de cálculo do ISS */
  iss_base?: number
  /** Alíquota ISS em percentual (ex: 5.00 = 5%) */
  iss_rate?: number
  /** Valor ISS calculado */
  iss_value?: number
  /** true = ISS retido na fonte pelo tomador */
  iss_retained?: boolean

  // --- Retenções federais (somente NFS-e) ---
  ir_value?: number
  csll_value?: number
  inss_value?: number
}

// ---------------------------------------------------------------------------
// TRIBUTOS DA REFORMA (IBS/CBS) — por item
// ---------------------------------------------------------------------------

/**
 * Campos da Reforma Tributária do Consumo por item.
 *
 * NF-e/NFC-e: campos em det.imposto.IBSCBS.gIBSCBS (por item)
 * CT-e: campos em infCte.imp.IBSCBS.gIBSCBS (nível documento, atribuído ao item[0])
 * NFS-e Nacional: campos em valores.trib.tribFed.IBSCBS (nível documento = item único)
 *
 * Campos ausentes = documento anterior à vigência ou operação isenta (não é erro).
 */
export interface ItemTaxesRTC {
  /** Código de Situação Tributária IBS/CBS (3 dígitos) */
  cst?: string
  /**
   * Código de classificação tributária (6 dígitos).
   * Presente em NF-e/NFC-e. Ausente em NFS-e (usa cTribNac).
   */
  c_class_trib?: string
  /** Base de cálculo IBS/CBS */
  vBC?: number

  // IBS Estadual — presente em NF-e/NFC-e/CT-e; ausente em NFS-e (usa vIBS total)
  /** Alíquota IBS Estadual (%) */
  pIBSUF?: number
  /** Valor IBS Estadual (R$) */
  vIBSUF?: number

  // IBS Municipal — presente em NF-e/NFC-e/CT-e; ausente em NFS-e
  /** Alíquota IBS Municipal (%) */
  pIBSMun?: number
  /** Valor IBS Municipal (R$) */
  vIBSMun?: number

  // IBS Total
  /** Alíquota IBS total (%) — NFS-e usa este campo unificado */
  pIBS?: number
  /** Valor IBS Total = vIBSUF + vIBSMun */
  vIBS?: number

  // CBS (federal — todos os documentos)
  /** Alíquota CBS (%) */
  pCBS?: number
  /** Valor CBS (R$) */
  vCBS?: number
}

// ---------------------------------------------------------------------------
// ITEM DO DOCUMENTO
// ---------------------------------------------------------------------------

/**
 * Representa um item de produto (NF-e/NFC-e), componente de frete (CT-e)
 * ou serviço (NFS-e).
 */
export interface DocumentItem {
  /** Número sequencial do item */
  item_number: number
  /**
   * Descrição do produto/serviço.
   * NFS-e: conteúdo de xDescServ.
   */
  description: string
  /**
   * Código CFOP (NF-e/NFC-e/CT-e) ou Código NBS/LC116 (NFS-e).
   * Usado como METADADO INFORMATIVO, não como driver de crédito/débito.
   */
  cfop: string
  /**
   * NCM do produto (NF-e/NFC-e) ou código de tributação municipal (NFS-e).
   * CT-e: valor fixo 'N/A'.
   */
  ncm: string
  /** Valor bruto do item */
  gross_value: number
  /** Desconto do item */
  discount_value: number
  /** Valor líquido = gross_value - discount_value */
  net_value: number
  /** Tributos legados (ICMS, PIS, COFINS, IPI, ISS, retenções) */
  taxes_current: ItemTaxesCurrent
  /**
   * Tributos da Reforma (IBS/CBS).
   * Pode ser objeto vazio {} para documentos pré-reforma ou operações isentas.
   */
  rtc: ItemTaxesRTC
  /**
   * Impacto na apuração RTC.
   * Enriquecido pelo TaxAnalyzerService após detecção de CNPJ raiz.
   * Driver: DIRECTION, não CFOP.
   */
  rtc_impact?: RtcImpact
}

// ---------------------------------------------------------------------------
// TOTAIS DO DOCUMENTO
// ---------------------------------------------------------------------------

/** Totais consolidados do documento (cabeçalho) */
export interface DocumentTotals {
  /** Valor total dos produtos/serviços */
  vProd?: number
  /** Descontos totais */
  vDesc?: number
  /** Frete (NF-e) */
  vFrete?: number
  /** Seguro (NF-e) */
  vSeg?: number
  /** Outras despesas acessórias (NF-e) */
  vOutro?: number
  /** Total estimado de tributos (todos os regimes) */
  vTotTrib?: number
  /** Total ICMS */
  vICMS?: number
  /** Total PIS */
  vPIS?: number
  /** Total COFINS */
  vCOFINS?: number
  /** Total ISS (NFS-e) */
  vISS?: number
  /** ISS retido total (NFS-e) */
  vISSRet?: number

  // RTC — Reforma Tributária
  /** Base de cálculo IBS/CBS total */
  vBCIBSCBS?: number
  /** IBS total do documento */
  vIBS?: number
  /** CBS total do documento */
  vCBS?: number
}

// ---------------------------------------------------------------------------
// LOG DE PROCESSAMENTO
// ---------------------------------------------------------------------------

/** Entrada de log gerada durante o processamento de um arquivo/documento */
export interface ProcessingLog {
  /** Momento do registro */
  timestamp: string
  level: LogLevel
  category: LogCategory
  /** Nome do arquivo ou chave de acesso relacionada */
  source: string
  /** Mensagem legível pelo usuário */
  message: string
  /** Detalhe técnico opcional (para diagnóstico interno) */
  detail?: string
}

// ---------------------------------------------------------------------------
// RESULTADO DO PARSER
// ---------------------------------------------------------------------------

/** Retorno padronizado de qualquer parser */
export interface ParseResult {
  /** Documento parseado. null em caso de FATAL. */
  document: FiscalDocument | null
  /** Logs gerados durante o processamento deste arquivo */
  logs: ProcessingLog[]
  /** true = documento parseado com sucesso (VALID ou PARTIAL) */
  success: boolean
}

// ---------------------------------------------------------------------------
// DOCUMENTO FISCAL — ENTIDADE CENTRAL
// ---------------------------------------------------------------------------

/**
 * Representa um documento fiscal processado e enriquecido.
 * É a entidade central de todo o sistema.
 *
 * Ciclo de vida:
 * 1. Parser produz FiscalDocument com dados brutos do XML
 * 2. TaxAnalyzerService enriquece com direction, rtc_impact por item
 * 3. Store armazena em memória (sessão apenas — LGPD/Privacy by Design)
 * 4. UI lê e exibe; ExportService serializa para Excel
 */
export interface FiscalDocument {
  // --- Identificação ---
  /** Chave de acesso SEFAZ (44 dígitos) para NF-e/NFC-e/CT-e. Para NFS-e: "{CNPJ}_{numero}" */
  access_key: string
  document_type: DocumentType
  /** Versão do leiaute XML (ex: "4.00", "3.00") */
  version: string

  // --- Datas ---
  /** Data/hora de emissão (ISO 8601) */
  issue_date: string
  /**
   * Data de competência (somente NFS-e).
   * Pode diferir da emissão — é a data fiscalmente relevante para apuração.
   */
  competency_date?: string

  // --- Finalidade e Regime ---
  purpose: DocumentPurpose
  tax_regime: TaxRegime

  // --- Participantes ---
  /** Emitente (NF-e/NFC-e/CT-e) ou Prestador (NFS-e) */
  issuer: Participant
  /** Destinatário (NF-e/NFC-e/CT-e) ou Tomador (NFS-e) */
  receiver: Participant
  /** Remetente — somente CT-e */
  sender?: Participant

  // --- Valores e Tributos ---
  /** Valor total do documento */
  total_value: number
  totals: DocumentTotals
  /** Itens (produtos, componentes de frete ou serviço) */
  items: DocumentItem[]

  // --- Localização (NFS-e) ---
  /** Código IBGE do município de prestação do serviço */
  municipality_code?: string

  // --- Metadados de Vinculação ---
  /**
   * Chaves de NF-e referenciadas — somente CT-e.
   * Permite matching futuro CT-e ↔ NF-e.
   */
  referenced_keys?: string[]

  // --- Enriquecimento (TaxAnalyzerService) ---
  /**
   * Direção inferida pelo CNPJ raiz da empresa analisada.
   * Undefined = não enriquecido ainda (CNPJ raiz não detectado).
   */
  direction?: DocumentDirection

  // --- Processamento ---
  status: DocumentStatus
  /** Nome do arquivo original (para rastreabilidade) */
  source_filename: string
  /** XML bruto original — mantido em memória para auditoria/reprocessamento */
  raw_xml: string
}
