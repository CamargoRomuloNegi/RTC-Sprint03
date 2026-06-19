/**
 * @file Header.tsx
 * @description Cabeçalho com contador de documentos, CNPJ analisado, exportação e botão de limpar sessão.
 */
'use client'

import { Trash2, Download, Building2 } from 'lucide-react'
import { useFiscalStore }  from '@/application/store/useFiscalStore'
import { exportToExcel }   from '@/application/services/ExportService'

import { Button }          from '@/components/ui/Button'
import { useState }        from 'react'

export function Header() {
  const documents = useFiscalStore(s => s.documents)
  const cnpjRoot  = useFiscalStore(s => s.analyzedCnpjRoot)
  const clearAll  = useFiscalStore(s => s.clearAll)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (documents.length === 0) return
    setExporting(true)
    try { await exportToExcel(documents) }
    finally { setExporting(false) }
  }

  const handleClear = () => {
    if (documents.length === 0) return
    if (window.confirm(`Limpar ${documents.length} documento(s) da sessão? Esta ação não pode ser desfeita.`)) {
      clearAll()
    }
  }

  return (
    <header style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'0 20px',height:'var(--header-height)',
      background:'var(--color-surface)',borderBottom:'1px solid var(--color-border)',
      flexShrink:0,gap:'12px',
    }}>

      {/* Empresa analisada */}
      <div style={{ display:'flex',alignItems:'center',gap:'8px',flex:1,minWidth:0 }}>
        <Building2 size={15} style={{ color:'var(--color-text-muted)',flexShrink:0 }} />
        <span style={{ fontSize:'0.8rem',color:'var(--color-text-muted)',flexShrink:0 }}>Empresa:</span>
        {cnpjRoot ? (
          <span style={{ fontFamily:'var(--font-data)',fontSize:'0.82rem',fontWeight:600,color:'var(--color-primary)',background:'var(--color-primary-light)',padding:'2px 8px',borderRadius:'4px' }}>
            CNPJ raiz {cnpjRoot}
          </span>
        ) : (
          <span style={{ fontSize:'0.8rem',color:'var(--color-text-muted)',fontStyle:'italic' }}>
            {documents.length > 0 ? 'Detectando…' : 'Aguardando upload'}
          </span>
        )}
      </div>

      {/* Ações */}
      <div style={{ display:'flex',alignItems:'center',gap:'8px',flexShrink:0 }}>

        {/* Contador */}
        {documents.length > 0 && (
          <span style={{ fontSize:'0.78rem',color:'var(--color-text-muted)',background:'var(--color-bg)',border:'1px solid var(--color-border)',borderRadius:'20px',padding:'2px 10px',fontFamily:'var(--font-data)' }}>
            {documents.length} doc{documents.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Exportar Excel */}
        <Button
          variant="primary"
          size="sm"
          icon={<Download size={13} />}
          loading={exporting}
          disabled={documents.length === 0}
          onClick={handleExport}
        >
          Exportar Excel
        </Button>

        {/* Limpar sessão */}
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={13} />}
          disabled={documents.length === 0}
          onClick={handleClear}
        >
          Limpar
        </Button>
      </div>
    </header>
  )
}
