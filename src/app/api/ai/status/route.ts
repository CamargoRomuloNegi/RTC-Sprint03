/**
 * @file /api/ai/status/route.ts
 * @description Endpoint leve de verificação de configuração da IA.
 *
 * GET /api/ai/status
 * Resposta: { configured: boolean }
 *
 * Não faz chamada ao Gemini — apenas verifica process.env.
 * Custo: zero. Usado pela tela de Settings para exibir o indicador de status.
 */
import { NextResponse } from 'next/server'
import type { AiStatusResponse } from '@/domain/models/AiTypes'

export async function GET(): Promise<NextResponse<AiStatusResponse>> {
  const configured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0
  )

  return NextResponse.json(
    { configured },
    {
      status: 200,
      headers: {
        // Cache curto — evita chamadas desnecessárias repetidas
        'Cache-Control': 'private, max-age=30',
      },
    }
  )
}
