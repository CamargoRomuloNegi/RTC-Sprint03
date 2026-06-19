/**
 * @file next.config.ts
 * @description Configuração do Next.js com HTTP Security Headers.
 *
 * SEGURANÇA (Sprint 4):
 *   Todos os headers são aplicados a todas as rotas (source: '/(.*)')
 *
 *   X-Frame-Options: DENY
 *     → Impede clickjacking via iframe em domínio externo
 *
 *   X-Content-Type-Options: nosniff
 *     → Impede MIME sniffing pelo browser
 *
 *   Referrer-Policy: strict-origin-when-cross-origin
 *     → Controla vazamento de URL em requisições cross-origin
 *
 *   Permissions-Policy: camera=(), microphone=(), geolocation=()
 *     → Desabilita APIs do browser não utilizadas
 *
 *   X-DNS-Prefetch-Control: on
 *     → Mantém DNS prefetch ativo (melhora latência para Gemini API)
 *
 *   Strict-Transport-Security
 *     → HSTS: força HTTPS por 2 anos (só ativo em HTTPS — Vercel produção)
 *
 *   Content-Security-Policy: ADIADO para v2.0
 *     → Requer análise de violações em report-only antes de enforçar
 */
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ESLint — não bloqueia build (roda via npm run lint)
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Garante que bibliotecas client-only (JSZip, SheetJS) sejam tratadas corretamente
  serverExternalPackages: [],

  // HTTP Security Headers
  async headers() {
    return [
      {
        // Aplica a todas as rotas
        source: '/(.*)',
        headers: [
          {
            key:   'X-Frame-Options',
            value: 'DENY',
          },
          {
            key:   'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key:   'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key:   'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key:   'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            // HSTS: máximo 2 anos, incluindo subdomínios
            // O Next.js aplica apenas em respostas HTTPS —
            // em localhost (HTTP) este header é ignorado pelo browser
            key:   'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
