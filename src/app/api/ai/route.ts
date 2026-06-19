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
// PROMPT DO DOSSIÊ v4 — análise adaptada ao regime da empresa
// ---------------------------------------------------------------------------
//
// INOVAÇÃO: o prompt identifica o regime da empresa analisada e adapta
// a análise à matriz:
//
//  Regime    | Compras          | Vendas | Análise prioritária
//  ──────────┼──────────────────┼────────┼──────────────────────────────────
//  RPA       | qualquer         | B2B/B2C| Crédito/débito pleno
//  Simples   | com créditos     | B2C    | Vale a pena mudar de regime?
//  Simples   | com créditos     | B2B    | Risco competitivo — migrar ou não?
//  Simples   | neutro (simples) | B2C    | Sem créditos e sem impacto B2C
//  Simples   | neutro           | B2B    | Atenção ao posicionamento de preço

function buildReportPrompt(context: AiContext): string {
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const byType = context.byDocType
    .map(t =>
      `  - ${t.tipo}: ${t.count} documentos | Crédito IBS/CBS: R$ ${brl(t.credito)} | Débito IBS/CBS: R$ ${brl(t.debito)}`
    )
    .join('\n')

  const cfops = context.topCfops
    .map((cfop, i) =>
      `  ${i + 1}. CFOP ${cfop.cfop} — Crédito: R$ ${brl(cfop.credito)} | Débito: R$ ${brl(cfop.debito)}`
    )
    .join('\n')

  const temporal = context.temporal
    .map(t =>
      `  - ${t.label}: Crédito R$ ${brl(t.credito)} | Débito R$ ${brl(t.debito)} | Saldo R$ ${brl(t.saldo)}`
    )
    .join('\n')

  const posicao  = context.ibscbs.saldo >= 0 ? 'CREDORA' : 'DEVEDORA'
  const saldoAbs = Math.abs(context.ibscbs.saldo)

  // Análise de regime para o prompt
  const regime = context.companyRegime
  const pp     = context.purchaseProfile
  const sp     = context.salesProfile

  const perfilCompras = pp.creditCoverageRate >= 60
    ? `COM CRÉDITOS (${pp.creditCoverageRate.toFixed(1)}% do valor das compras tem IBS/CBS de fornecedores RPA)`
    : pp.creditCoverageRate >= 20
    ? `MISTO (${pp.creditCoverageRate.toFixed(1)}% das compras com IBS/CBS — ${pp.neutral} docs de Simples/MEI sem crédito)`
    : `PREDOMINANTEMENTE NEUTRO (apenas ${pp.creditCoverageRate.toFixed(1)}% das compras geram crédito — maioria de fornecedores Simples/MEI)`

  const perfilVendas = sp.b2bRate >= 70
    ? `PREDOMINANTEMENTE B2B (${sp.b2bRate.toFixed(1)}% para CNPJs — clientes empresas)`
    : sp.b2bRate >= 30
    ? `MISTO (${sp.b2bRate.toFixed(1)}% B2B para CNPJs / ${(100 - sp.b2bRate).toFixed(1)}% B2C para CPFs/consumidores)`
    : `PREDOMINANTEMENTE B2C (${(100 - sp.b2bRate).toFixed(1)}% consumidor final — CPF ou anônimo)`

  // Instrução específica para o regime detectado
  let regimeInstruction = ''

  if (regime === 'RPA') {
    regimeInstruction = `
## INSTRUÇÃO ESPECIAL — REGIME NORMAL (RPA)
A empresa é tributada pelo Regime Normal (RPA). Realize análise PLENA de créditos e débitos:
- Calcule e interprete o saldo credor/devedor com precisão
- Avalie a eficiência da não-cumulatividade (créditos capturados vs. potencial)
- Identifique CFOPs e tipos de documento com maior impacto
- Recomende ações para maximização de créditos e gestão dos débitos`
  } else if (regime === 'SIMPLES_NACIONAL' || regime === 'MEI') {
    const isB2B = sp.b2bRate >= 50
    const hasCredits = pp.creditCoverageRate >= 30

    if (hasCredits && isB2B) {
      regimeInstruction = `
## INSTRUÇÃO ESPECIAL — SIMPLES NACIONAL com COMPRAS CREDENCIADAS e VENDAS B2B ⚠️ ANÁLISE CRÍTICA
Este é o cenário de MAIOR ATENÇÃO sob a Reforma Tributária:
- A empresa compra de fornecedores RPA que destacam IBS/CBS (${pp.creditCoverageRate.toFixed(1)}% do valor das compras)
- MAS vende predominantemente para empresas (${sp.b2bRate.toFixed(1)}% B2B), que QUEREM TOMAR CRÉDITO dos fornecedores
- Permanecendo no Simples Nacional, NÃO destaca IBS/CBS nas saídas → clientes B2B perdem crédito → RISCO COMPETITIVO ALTO

OBRIGATÓRIO analisar:
1. O valor do IBS/CBS que os clientes B2B DEIXAM DE APROVEITAR por comprar de fornecedor Simples
2. Se a migração para Regime Normal ou regime híbrido (Dual) seria financeiramente vantajosa
3. A comparação entre a carga tributária atual no Simples vs. a carga no RPA com aproveitamento pleno
4. O impacto na competitividade de preço vs. concorrentes RPA que permitem crédito ao cliente`
    } else if (hasCredits && !isB2B) {
      regimeInstruction = `
## INSTRUÇÃO ESPECIAL — SIMPLES NACIONAL com COMPRAS CREDENCIADAS e VENDAS B2C
A empresa compra com IBS/CBS disponível (${pp.creditCoverageRate.toFixed(1)}% das compras de RPA) mas vende predominantemente ao consumidor final (${(100 - sp.b2bRate).toFixed(1)}% B2C):
- O consumidor final NÃO toma créditos de IBS/CBS → o destacamento não agrega valor ao cliente
- A migração de regime pode NÃO ser vantajosa neste perfil
- Porém, avalie o custo do IBS/CBS embutido nas compras vs. a economia tributária do Simples

ANALISAR:
1. O IBS/CBS pago nas compras (embutido no custo) vs. a vantagem da alíquota reduzida do Simples
2. Se a empresa tem margem para absorver o imposto nas compras sem migrar
3. Projeção comparativa: Simples atual vs. RPA com créditos plenos`
    } else {
      regimeInstruction = `
## INSTRUÇÃO ESPECIAL — SIMPLES NACIONAL com FORNECEDORES PREDOMINANTEMENTE SIMPLES
A empresa compra majoritariamente de fornecedores Simples/MEI (${pp.neutral} docs sem IBS/CBS — apenas ${pp.creditCoverageRate.toFixed(1)}% das compras com crédito):
- Cadeia predominantemente Simples: baixo impacto imediato da RTC
- Vendas ${perfilVendas.toLowerCase()}

ANALISAR:
1. O perfil da cadeia de fornecimento e se há tendência de migração dos fornecedores para RPA
2. O risco futuro conforme alíquotas de transição aumentam (2027-2033)
3. Recomendações de monitoramento e planejamento preventivo`
    }
  }

  const dados = [
    `Período analisado: ${context.period}`,
    `Total de documentos: ${context.totalDocs.toLocaleString('pt-BR')}`,
    `Volume de entradas: R$ ${brl(context.volumes.inbound)}`,
    `Volume de saídas:   R$ ${brl(context.volumes.outbound)}`,
    `Volume total:       R$ ${brl(context.volumes.total)}`,
    '',
    `Crédito IBS/CBS: R$ ${brl(context.ibscbs.credito)} (${context.ibscbs.creditRate.toFixed(2)}% das entradas)`,
    `Débito IBS/CBS:  R$ ${brl(context.ibscbs.debito)} (${context.ibscbs.debitRate.toFixed(2)}% das saídas)`,
    `Saldo líquido:   R$ ${brl(saldoAbs)} — Posição ${posicao} (${Math.abs(context.ibscbs.balanceRate).toFixed(2)}% das saídas)`,
    '',
    `REGIME DA EMPRESA ANALISADA: ${regime}`,
    `Perfil de Compras: ${perfilCompras}`,
    `  - Fornecedores RPA com IBS/CBS: ${pp.withCredits} docs`,
    `  - Fornecedores Simples/MEI sem IBS/CBS: ${pp.neutral} docs`,
    `Perfil de Vendas: ${perfilVendas}`,
    `  - Vendas B2B (para CNPJs/empresas): ${sp.b2b} docs`,
    `  - Vendas B2C (para CPFs/consumidor): ${sp.b2c} docs`,
    '',
    `Regime tributário dos fornecedores (INBOUND):`,
    `  - RPA: ${context.byRegime.rpa} docs`,
    `  - Simples Nacional: ${context.byRegime.simples} docs`,
    `  - MEI: ${context.byRegime.mei} docs`,
    `  - Docs RPA sem IBS/CBS em 2026 (inconformes): ${context.inconformes}`,
    '',
    'Por tipo de documento:',
    byType,
    '',
    'Top CFOPs por volume de IBS/CBS:',
    cfops,
    '',
    'Evolução mensal:',
    temporal,
  ].join('\n')

  const secoes = [
    '1. **Sumário Executivo** — panorama do período, regime identificado, posição credora/devedora e principal diagnóstico.',
    '2. **Posição RTC** — tabela com créditos, débitos, saldo e índices percentuais. Interpretação fiscal dos indicadores.',
    '3. **Análise de Regime e Estratégia Tributária** — seção prioritária adaptada ao regime detectado (ver instrução especial acima). Use tabelas comparativas.',
    '4. **Conformidade** — qualidade da carteira de fornecedores, risco de créditos perdidos, impacto financeiro.',
    '5. **Por Tipo de Documento** — tabela com participação de cada espécie e IBS/CBS gerado.',
    '6. **Por CFOP** — análise dos CFOPs com maior concentração, natureza da operação e atenção a regimes diferenciados.',
    '7. **Evolução Temporal** — médias mensais, tendência e regularidade do período.',
    '8. **Recomendações** — ações prioritárias (Alta/Média/Baixa) com impacto financeiro estimado e prazo.',
    '9. **Conclusão** — diagnóstico consolidado e perspectiva estratégica.',
  ].join('\n')

  return `Atue como contador especialista, tributarista experiente e conhecedor profundo da Reforma Tributária do Consumo (RTC) — IBS e CBS instituídos pela LC 214/2025.

Com base exclusivamente nos dados estatísticos a seguir, elabore um DOSSIÊ TÉCNICO TRIBUTÁRIO profissional nas seções indicadas.

${regimeInstruction}

## SEÇÕES OBRIGATÓRIAS:
${secoes}

---

DADOS ESTATÍSTICOS BASE (use apenas estes — não extrapole nem invente):

${dados}

---

INSTRUÇÕES DE FORMATAÇÃO:
- Use TABELAS Markdown (formato | col | col | col |) para comparativos e indicadores numéricos
- Negrito, subtítulos ##, listas hierárquicas
- Valores em R$ com 2 casas decimais (padrão pt-BR: vírgula decimal)
- Tom técnico e assertivo para diretores e contadores
- Não exiba cálculos intermediários — apresente resultados e sua interpretação
- Não cite dados além do fornecido`
}



// ---------------------------------------------------------------------------
// VERIFICAÇÃO DE ORIGEM
// ---------------------------------------------------------------------------
//
// VERCEL_URL contém a URL da *deployment* específica (preview ou produção),
// que muda a cada deploy. Não é confiável para comparar com a origin real.
// VERCEL_PROJECT_PRODUCTION_URL é a URL canônica de produção — mais adequada.
//
// Para o beta, aceitamos qualquer origem que seja:
//   - localhost (desenvolvimento)
//   - *.vercel.app (produção / preview Vercel)
//   - O domínio de produção configurado (NEXT_PUBLIC_APP_URL, opcional)
//
// O risco de abuse é mitigado pelo rate limiting do próprio Gemini na chave.
// CSRF token completo está planejado para v2.0.

function isOriginAllowed(request: NextRequest): boolean {
  const origin  = request.headers.get('origin')  ?? ''
  const referer = request.headers.get('referer') ?? ''
  const source  = origin || referer

  // Sem origin/referer (ex: chamadas diretas sem browser) — aceitar em dev
  if (!source) {
    return !process.env.VERCEL_URL // true em local, false em produção
  }

  // Desenvolvimento local
  if (source.includes('localhost') || source.includes('127.0.0.1')) return true

  // Qualquer subdomínio Vercel do projeto (produção e previews)
  if (source.includes('.vercel.app')) return true

  // Domínio customizado opcional (configurado pelo operador)
  const customDomain = process.env.NEXT_PUBLIC_APP_URL
  if (customDomain && source.startsWith(customDomain)) return true

  return false
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

  // maxTokens é apenas informativo — o dossiê usa o máximo do modelo.
  // Free Tier do Gemini limita RPM (15/min), não o tamanho de cada resposta.
  // Travar tokens artificialmente degrada a qualidade sem proteger nada.
  const _maxTokensHint = Number(p.maxTokens ?? 8192) // ignorado na prática
  void _maxTokensHint // suprime warning de variável não usada

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
          maxOutputTokens: 65536, // limite máximo do Gemini 3.5 Flash — dossiê completo sem truncamento
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
