/**
 * @file useAiStore.ts
 * @description Store Zustand para o módulo de IA.
 *
 * PERSISTÊNCIA SELETIVA:
 *   - Configurações (model, maxTokens): persistem via localStorage
 *   - Histórico de turnos: apenas sessão, descartado ao fechar
 *   - isLoading, error: estado transitório, nunca persistido
 *
 * SSR SAFETY: skipHydration:true evita mismatch entre servidor e cliente.
 * O componente que usa este store deve chamar rehydrate() em useEffect.
 */
'use client'

import { create }    from 'zustand'
import { persist }   from 'zustand/middleware'
import type {
  GeminiModel, AiTurn, AiSettings,
} from '@/domain/models/AiTypes'
import { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from '@/domain/models/AiTypes'

// ---------------------------------------------------------------------------
// INTERFACE DO STORE
// ---------------------------------------------------------------------------

interface AiStore extends AiSettings {
  // Estado de sessão (não persistido)
  history:   AiTurn[]
  isLoading: boolean
  error:     string | null

  // Ações — configurações
  setModel:       (model: GeminiModel) => void
  setMaxTokens:   (tokens: number) => void
  setCompanyLogo: (logo: string | undefined) => void
  setCompanyName: (name: string) => void

  // Ações — sessão
  addTurn:      (turn: AiTurn) => void
  clearHistory: () => void
  setLoading:   (loading: boolean) => void
  setError:     (error: string | null) => void
}

// ---------------------------------------------------------------------------
// STORE COM PERSISTÊNCIA SELETIVA
// ---------------------------------------------------------------------------

export const useAiStore = create<AiStore>()(
  persist(
    (set) => ({
      // Configurações (persistidas)
      model:       DEFAULT_MODEL,
      maxTokens:   DEFAULT_MAX_TOKENS,
      companyLogo: undefined,
      companyName: '',

      // Estado de sessão (não persistido, mas inicializado aqui)
      history:   [],
      isLoading: false,
      error:     null,

      // Ações
      setModel:       (model)       => set({ model }),
      setMaxTokens:   (maxTokens)   => set({ maxTokens }),
      setCompanyLogo: (companyLogo) => set({ companyLogo }),
      setCompanyName: (companyName) => set({ companyName }),

      addTurn: (turn) =>
        set((state) => ({
          history: [turn, ...state.history].slice(0, 5), // máximo 5 turnos
        })),

      clearHistory: () => set({ history: [] }),
      setLoading:   (isLoading) => set({ isLoading }),
      setError:     (error)     => set({ error }),
    }),
    {
      name:    'rtc_ai_settings',
      // Persistir APENAS as configurações operacionais — nunca dados de sessão
      partialize: (state) => ({
        model:       state.model,
        maxTokens:   state.maxTokens,
        companyLogo: state.companyLogo,
        companyName: state.companyName,
      }),
      // Evita erro de hidratação SSR — componentes chamam rehydrate() em useEffect
      skipHydration: true,
    },
  ),
)
