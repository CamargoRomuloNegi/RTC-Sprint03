import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Habilita análise de bundle em builds de produção (útil para otimização futura)
  // NEXT_ANALYZE=true npm run build
  ...(process.env.NEXT_ANALYZE === 'true' && {
    experimental: {},
  }),

  // Garante que bibliotecas client-only (JSZip, SheetJS) sejam tratadas corretamente
  serverExternalPackages: [],
}

export default nextConfig
