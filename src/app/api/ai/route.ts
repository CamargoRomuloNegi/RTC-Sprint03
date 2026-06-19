/**
 * @file /api/ai/route.ts
 * @description Route Handler — gera o Dossiê Tributário RTC via Gemini.
 *
 * MUDANÇA Sprint 4 v2: não há mais perguntas livres.
 * A IA recebe os dados agregados e produz um relatório estruturado completo.
 *
 * BUG CORRIGIDO: SSE buffering — o Gemini envia múltiplos eventos por chunk TCP.
 * O buffer acumula fragmentos até encontrar o delimitador \n\n antes de parsear.
 *
 * SEGURANÇA:
 *   - Chave lida de process.env (nunca exposta ao browser)
 *   - Origem verificada em produção
 *   - Payload validado (tamanho, tipos)
 *   - Erros tratados sem vazar detalhes internos
 */
import { NextRequest, NextResponse } from 'next/server'
import type { AiContext }             from '@/domain/models/AiTypes'
import { GEMINI_MODELS }              from '@/domain/models/AiTypes'
import type { GeminiModel }           from '@/domain/models/AiTypes'

// ---------------------------------------------------------------------------
// PROMPT DO DOSSIÊ — estrutura fixa e profissional
// ---------------------------------------------------------------------------

function buildReportPrompt(context: AiContext): string {
  return `Você é um consultor tributário sênior especializado na Reforma Tributária do Consumo brasileira (IBS e CBS, LC 214/2025).

Com base exclusivamente nos dados abaixo, elabore um **DOSSIÊ TRIBUTÁRIO COMPLETO** em Markdown. Seja técnico, objetivo e profissional. Use os valores exatos fornecidos.

## DADOS DA APURAÇÃO
${JSON.stringify(context, null, 2)}

---

## ESTRUTURA OBRIGATÓRIA DO DOSSIÊ

# Dossiê de Apuração IBS/CBS
**Período:** ${context.period} | **Documentos analisados:** ${context.totalDocs.toLocaleString('pt-BR')}

## 1. Sumário Executivo
Apresente em 3 parágrafos: (a) posição geral credora ou devedora com os valores reais, (b) o que essa posição significa operacionalmente para a empresa, (c) o principal ponto de atenção do período.

## 2. Análise da Posição RTC
Analise em detalhes:
- Total de créditos IBS/CBS e o índice percentual sobre as entradas
- Total de débitos IBS/CBS e o índice percentual sobre as saídas
- Saldo do período (posição credora ou devedora) e o índice sobre as saídas
- Interpretação prática: o que esses índices revelam sobre a carga tributária efetiva

## 3. Conformidade da Carteira de Fornecedores
- Quantidade de documentos de fornecedores RPA sem IBS/CBS destacado
- Impacto financeiro estimado (créditos não aproveitados)
- Classificação do risco (alto/médio/baixo) com justificativa
- Recomendações de ação para regularização

## 4. Distribuição por Tipo de Documento
Para cada tipo presente (NF-e, NFC-e, CT-e, NFS-e):
- Quantidade e participação no volume total
- Crédito e débito de IBS/CBS gerado
- Observações relevantes

## 5. Concentração por CFOP
- Top CFOPs com maior impacto em IBS/CBS
- Análise se a concentração representa risco ou oportunidade
- CFOPs que geram débito vs CFOPs que geram crédito

## 6. Análise Temporal e Tendência
Com base na evolução mensal:
- Meses com melhor e pior saldo
- Tendência identificada (melhora, piora, estável)
- Sazonalidade ou padrão observado nos dados

## 7. Pontos de Atenção e Recomendações
Liste em ordem de prioridade (Alta/Média/Baixa):
- Riscos identificados com impacto financeiro estimado
- Oportunidades de otimização tributária
- Ações recomendadas com prazo sugerido

## 8. Conclusão
Parágrafo final com o diagnóstico consolidado e a perspectiva para os próximos períodos.

---
REGRAS: Use apenas dados do contexto. Cite valores em R$ com 2 casas decimais e percentuais com 2 casas decimais. Não invente informações.`
}

// ---------------------------------------------------------------------------
// VERIFICAÇÃO DE ORIGEM
// ---------------------------------------------------------------------------

function isOriginAllowed(request: NextRequest): boolean {
  if (!process.env.VERCEL_URL) return true // desenvolvimento local
  const origin  = request.headers.get('origin')  ?? ''
  const referer = request.headers.get('referer') ?? ''
  const allowed = `https://${process.env.VERCEL_URL}`
  return origin.startsWith(allowed) || referer.startsWith(allowed)
}

// ---------------------------------------------------------------------------
// ROUTE HANDLER — POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Origem
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403 })
  }

  // 2. Chave de API
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Módulo de IA não configurado. Adicione GEMINI_API_KEY nas variáveis de ambiente do Vercel.' },
      { status: 503 }
    )
  }

  // 3. Tamanho do payload
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 20_000) {
    return NextResponse.json({ error: 'Payload muito grande' }, { status: 413 })
  }

  // 4. Ler e validar body
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const p = body as Record<string, unknown>

  const model = p.model as GeminiModel
  if (!model || !Object.keys(GEMINI_MODELS).includes(model)) {
    return NextResponse.json({ error: 'Modelo inválido' }, { status: 400 })
  }

  const maxTokens = Number(p.maxTokens ?? 4096)
  if (maxTokens < 512 || maxTokens > 8192) {
    return NextResponse.json({ error: 'maxTokens fora do intervalo permitido' }, { status: 400 })
  }

  if (!p.context || typeof p.context !== 'object') {
    return NextResponse.json({ error: 'Contexto ausente' }, { status: 400 })
  }

  const context = p.context as AiContext
  const prompt  = buildReportPrompt(context)

  // 5. Chamar Gemini com streaming
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`

  let geminiRes: Response
  try {
    geminiRes = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature:     0.2,  // determinístico para análise fiscal
          topP:            0.8,
        },
      }),
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar ao Gemini. Verifique sua conexão.' }, { status: 502 })
  }

  // 6. Erros do Gemini
  if (!geminiRes.ok) {
    if (geminiRes.status === 429) {
      return NextResponse.json({
        error: 'Limite de requisições atingido. O plano gratuito permite 15 requisições/minuto. Aguarde e tente novamente.'
      }, { status: 429 })
    }
    if (geminiRes.status === 403) {
      return NextResponse.json({ error: 'Chave de API inválida ou sem permissão para este modelo.' }, { status: 403 })
    }
    return NextResponse.json({ error: `Erro do Gemini (${geminiRes.status}). Tente novamente.` }, { status: 502 })
  }

  if (!geminiRes.body) {
    return NextResponse.json({ error: 'Resposta vazia do Gemini' }, { status: 502 })
  }

  // 7. Streaming com buffer SSE correto
  // BUG ORIGINAL: split('\n') perdia chunks que chegavam fragmentados via TCP.
  // FIX: acumula no buffer e processa apenas eventos SSE completos (\n\n).
  const geminiBody = geminiRes.body

  const stream = new ReadableStream({
    async start(controller) {
      const reader  = geminiBody.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Processar apenas eventos SSE completos (delimitados por \n\n)
          const events = buffer.split('\n\n')
          // O último elemento pode ser um evento incompleto — manter no buffer
          buffer = events.pop() ?? ''

          for (const event of events) {
            for (const line of event.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue

              try {
                const parsed = JSON.parse(jsonStr) as {
                  candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> }
                  }>
                }
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text))
                }
              } catch {
                // Fragmento incompleto — ignorar
              }
            }
          }
        }

        // Processar buffer restante
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6).trim()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
              }
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) controller.enqueue(new TextEncoder().encode(text))
            } catch { /* ignorar */ }
          }
        }
      } catch {
        // Erro de leitura — encerrar graciosamente
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':           'text/plain; charset=utf-8',
      'Cache-Control':          'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
