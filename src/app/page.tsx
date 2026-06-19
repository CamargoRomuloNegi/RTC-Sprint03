/**
 * @file page.tsx  (rota "/")
 * @description Página de upload — ponto de entrada da ferramenta.
 */
'use client'

import { UploadZone } from '@/components/upload/UploadZone'
import { useFiscalStore } from '@/application/store/useFiscalStore'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function HomePage() {
  const docCount = useFiscalStore(s => s.documents.length)
  const router   = useRouter()

  return (
    <div style={{ maxWidth:'760px',margin:'0 auto' }}>

      {/* Título */}
      <div style={{ marginBottom:'28px' }}>
        <h1 style={{ fontSize:'1.5rem',fontWeight:700,color:'var(--color-text-primary)',marginBottom:'6px' }}>
          Apuração Assistida RTC
        </h1>
        <p style={{ fontSize:'0.9rem',color:'var(--color-text-secondary)',lineHeight:1.5 }}>
          Carregue seus XMLs fiscais (NF-e, NFC-e, CT-e, NFS-e) para apurar créditos e débitos de IBS/CBS
          da Reforma Tributária do Consumo.
        </p>
      </div>

      <UploadZone />

      {/* CTA após upload */}
      {docCount > 0 && (
        <div style={{ marginTop:'24px',display:'flex',justifyContent:'center',gap:'12px' }}>
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight size={16} />}
            onClick={() => router.push('/analysis')}
          >
            Ver Apuração RTC ({docCount} docs)
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.push('/explorer')}>
            Explorar Documentos
          </Button>
        </div>
      )}
    </div>
  )
}
