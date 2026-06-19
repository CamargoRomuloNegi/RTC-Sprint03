/**
 * @file layout.tsx
 * @description Root layout — Sidebar + Header fixos + área de conteúdo scrollável.
 */
import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Simples Apuração RTC',
  description: 'Apuração assistida de IBS/CBS — Reforma Tributária do Consumo',
  robots: 'noindex, nofollow',
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
