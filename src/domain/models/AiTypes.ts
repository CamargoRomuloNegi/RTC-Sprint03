/**
 * @file AiTypes.ts
 * @description Tipos do domínio para o Módulo de IA (Sprint 4).
 *
 * MODELOS GEMINI SUPORTADOS (verificados em ai.google.dev — junho/2026):
 *   gemini-3.5-flash      — Estável, maio/2026, Free Tier ✅
 *   gemini-2.5-flash      — Raciocínio híbrido, 1M tokens, Free Tier ✅
 *   gemini-2.5-flash-lite — Mais econômico, Free Tier ✅
 *
 * DESCONTINUADOS (não usar):
 *   gemini-2.0-flash      — Desligado em 01/jun/2026
 *   gemini-1.5-flash      — Legado, substituído
 */

// ---------------------------------------------------------------------------
// MODELOS
// ---------------------------------------------------------------------------

export type GeminiModel =
  | 'gemini-3.5-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'

export interface GeminiModelConfig {
  id:          GeminiModel
  label:       string
  description: string
  freeTier:    boolean
  maxOutput:   number   // máximo de tokens de saída suportado pelo modelo
}

export const GEMINI_MODELS: Record<GeminiModel, GeminiModelConfig> = {
  'gemini-3.5-flash': {
    id:          'gemini-3.5-flash',
    label:       'Gemini 3.5 Flash',
    description: 'Modelo mais avançado — fronteira de inteligência e velocidade (mai/2026)',
    freeTier:    true,
    maxOutput:   65536,
  },
  'gemini-2.5-flash': {
    id:          'gemini-2.5-flash',
    label:       'Gemini 2.5 Flash',
    description: 'Raciocínio híbrido com janela de 1 milhão de tokens',
    freeTier:    true,
    maxOutput:   65536,
  },
  'gemini-2.5-flash-lite': {
    id:          'gemini-2.5-flash-lite',
    label:       'Gemini 2.5 Flash-Lite',
    description: 'Mais econômico e veloz — ideal para perguntas diretas',
    freeTier:    true,
    maxOutput:   65536,
  },
}

export const DEFAULT_MODEL: GeminiModel = 'gemini-3.5-flash'
export const DEFAULT_MAX_TOKENS = 1024

// ---------------------------------------------------------------------------
// CONTEXTO DA IA — o que é enviado ao Gemini
// ---------------------------------------------------------------------------

/**
 * AiContext: sumário agregado dos documentos fiscais carregados.
 *
 * REGRA DE PRIVACIDADE (imutável):
 *   Este tipo NUNCA deve conter dados individuais:
 *   - Sem CNPJs individuais
 *   - Sem nomes de empresas
 *   - Sem chaves de acesso
 *   - Sem endereços ou dados pessoais
 *
 *   Apenas estatísticas agregadas são permitidas.
 */
export interface AiContext {
  // Metadados do período
  period:     string   // ex: "Jan/2026 – Mar/2026"
  totalDocs:  number

  // Volumes financeiros agregados (sem identificação)
  volumes: {
    inbound:  number   // soma de total_value de docs INBOUND
    outbound: number   // soma de total_value de docs OUTBOUND
    total:    number
  }

  // Apuração IBS/CBS
  ibscbs: {
    credito:     number
    debito:      number
    saldo:       number
    creditRate:  number   // % crédito / inbound
    debitRate:   number   // % débito / outbound
    balanceRate: number   // % saldo / outbound
  }

  // Distribuição por tipo de documento (sem CNPJs)
  byDocType: Array<{
    tipo:    string
    count:   number
    credito: number
    debito:  number
  }>

  // Distribuição por regime tributário
  byRegime: {
    rpa:     number
    simples: number
    mei:     number
  }

  // Inconformidades
  inconformes: number

  // Top CFOPs por volume de IBS/CBS (CFOPs são dados públicos SEFAZ)
  topCfops: Array<{
    cfop:    string
    credito: number
    debito:  number
  }>

  // Resumo temporal (períodos e seus saldos)
  temporal: Array<{
    label:   string
    credito: number
    debito:  number
    saldo:   number
  }>

  // ── ANÁLISE DE REGIME (Sprint 4 v4) ──────────────────────────────────────
  // Estes campos permitem ao prompt adaptar a análise ao perfil real da empresa.

  /** Regime tributário da empresa ANALISADA (detectado nos docs OUTBOUND) */
  companyRegime: 'RPA' | 'SIMPLES_NACIONAL' | 'MEI' | 'UNKNOWN'

  /** Perfil das compras (docs INBOUND): quais fornecedores têm IBS/CBS */
  purchaseProfile: {
    /** Docs de fornecedores RPA com IBS/CBS destacado (créditos aproveitáveis) */
    withCredits:       number
    /** Docs de fornecedores Simples/MEI — sem crédito de IBS/CBS */
    neutral:           number
    /** % do valor das entradas coberto por fornecedores com IBS/CBS */
    creditCoverageRate: number
  }

  /** Perfil das vendas (docs OUTBOUND): B2B vs B2C */
  salesProfile: {
    /** Docs para CNPJ (empresas) — B2B: cliente pode querer tomar crédito */
    b2b:     number
    /** Docs para CPF / consumidor anônimo — B2C: crédito não é relevante ao cliente */
    b2c:     number
    /** Percentual de saídas para empresas (B2B) */
    b2bRate: number
  }
}

// ---------------------------------------------------------------------------
// TURNOS DE CONVERSA
// ---------------------------------------------------------------------------

export interface AiTurn {
  id:        string
  question:  string
  answer:    string
  model:     GeminiModel
  tokens:    number
  timestamp: string
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÕES PERSISTIDAS
// ---------------------------------------------------------------------------

export interface AiSettings {
  model:     GeminiModel
  maxTokens: number
  /** Logo da empresa em base64 (data URL) — exibida no cabeçalho do dossiê exportado.
   *  Armazenada em localStorage como preferência visual, sem dados fiscais. */
  companyLogo?: string
  /** Nome da empresa para exibição no cabeçalho do dossiê */
  companyName?: string
}

// ---------------------------------------------------------------------------
// PAYLOAD DA REQUISIÇÃO AO ROUTE HANDLER
// ---------------------------------------------------------------------------

export interface AiRequestPayload {
  question:  string
  context:   AiContext
  model:     GeminiModel
  maxTokens: number
}

// ---------------------------------------------------------------------------
// RESPOSTA DO ENDPOINT DE STATUS
// ---------------------------------------------------------------------------

export interface AiStatusResponse {
  configured: boolean
  model?:     string
}
