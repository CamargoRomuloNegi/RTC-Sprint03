/**
 * @file useFiscalStore.ts
 * @description Store global da aplicação (Zustand).
 *
 * DECISÃO ARQUITETURAL: 100% in-memory (sem persistência).
 * Dados vivem apenas enquanto a aba do browser está aberta.
 * Motivo: LGPD / Privacy by Design — nenhum dado fiscal é gravado.
 * Ver: docs/PRD_v2.md — Seção 1.1
 *
 * ESTRUTURA DO ESTADO:
 * - documents[]: todos os documentos processados e enriquecidos
 * - logs[]: log consolidado de todos os processamentos da sessão
 * - analyzedCnpjRoot: CNPJ raiz da empresa analisada (detectado ou manual)
 * - isProcessing: flag de UI para feedback durante upload de lotes grandes
 */

'use client'

import { create } from 'zustand'
import type { FiscalDocument, ProcessingLog } from '@/domain/models/FiscalDocument'
import { enrichDocument } from '@/application/services/TaxAnalyzerService'

// ---------------------------------------------------------------------------
// TIPOS DO ESTADO
// ---------------------------------------------------------------------------

interface FiscalState {
  /** Documentos processados na sessão atual */
  documents: FiscalDocument[]
  /** Log consolidado de processamento (mais recente primeiro) */
  logs: ProcessingLog[]
  /** CNPJ raiz da empresa analisada (8 dígitos ou null) */
  analyzedCnpjRoot: string | null
  /** true enquanto um lote de XMLs está sendo processado */
  isProcessing: boolean

  // --- Ações ---
  /**
   * Adiciona um documento processado ao store.
   * Verifica duplicidade por access_key antes de inserir.
   * Se analyzedCnpjRoot estiver definido, enriquece o documento automaticamente.
   */
  addDocument: (doc: FiscalDocument) => void

  /**
   * Adiciona logs de processamento ao store.
   * Os novos logs são inseridos no início (prepend) para exibir os mais recentes primeiro.
   */
  addLogs: (newLogs: ProcessingLog[]) => void

  /**
   * Define o CNPJ raiz da empresa analisada.
   * Re-enriquece TODOS os documentos existentes com o novo CNPJ raiz.
   */
  setAnalyzedCnpjRoot: (cnpjRoot: string) => void

  /** Define o estado de processamento (para feedback na UI) */
  setIsProcessing: (processing: boolean) => void

  /** Limpa TODOS os dados da sessão (novo diagnóstico) */
  clearAll: () => void
}

// ---------------------------------------------------------------------------
// STORE
// ---------------------------------------------------------------------------

export const useFiscalStore = create<FiscalState>((set, get) => ({
  documents: [],
  logs: [],
  analyzedCnpjRoot: null,
  isProcessing: false,

  addDocument: (doc) => {
    const { documents, analyzedCnpjRoot } = get()

    // Verificar duplicidade por access_key
    const isDuplicate = documents.some((d) => d.access_key === doc.access_key)
    if (isDuplicate) {
      set((state) => ({
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            category: 'PARSE',
            source: doc.source_filename,
            message: `Documento duplicado ignorado: ${doc.access_key}`,
          },
          ...state.logs,
        ],
      }))
      return
    }

    // Enriquecer se CNPJ raiz já definido
    const enriched = analyzedCnpjRoot ? enrichDocument(doc, analyzedCnpjRoot) : doc

    set((state) => ({
      documents: [enriched, ...state.documents],
    }))
  },

  addLogs: (newLogs) => {
    set((state) => ({
      logs: [...newLogs, ...state.logs],
    }))
  },

  setAnalyzedCnpjRoot: (cnpjRoot) => {
    const { documents } = get()

    // Re-enriquecer todos os documentos existentes
    const reEnriched = documents.map((doc) => enrichDocument(doc, cnpjRoot))

    set({ analyzedCnpjRoot: cnpjRoot, documents: reEnriched })
  },

  setIsProcessing: (processing) => {
    set({ isProcessing: processing })
  },

  clearAll: () => {
    set({ documents: [], logs: [], analyzedCnpjRoot: null, isProcessing: false })
  },
}))
