/**
 * @file layout.tsx
 * @description Root layout com fontes locais via @fontsource (npm).
 *
 * SEGURANÇA (Sprint 4):
 * Fontes Outfit e IBM Plex Mono são servidas localmente via @fontsource.
 * Zero dependência de CDN externo em runtime (fonts.googleapis.com).
 * As fontes são incluídas no bundle durante o build.
 *
 * Alternativa para Vercel: se preferir next/font/google, funciona
 * identicamente em termos de resultado — fontes localizadas no build.
 * O @fontsource foi escolhido por funcionar em ambientes offline também.
 */
import type { Metadata } from 'next'
import './globals.css'
// Fontes via @fontsource — servidas localmente, sem CDN externo
import '@fontsource/outfit/300.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header }  from '@/components/layout/Header'

export const metadata: Metadata = {
  title:       'Simples Apuração RTC',
  description: 'Apuração assistida de IBS/CBS — Reforma Tributária do Consumo',
  robots:      'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <Header />
            <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
