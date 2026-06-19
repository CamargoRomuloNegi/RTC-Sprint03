/**
 * @file UploadZone.tsx
 * @description Componente central de upload e processamento de XMLs fiscais.
 *
 * RESPONSABILIDADES:
 *   1. Drag & drop ou clique para selecionar arquivos XML ou ZIP
 *   2. Extração de XMLs de ZIPs (JSZip)
 *   3. Detecção de tipo + parsing via DocumentDetector + ParserFactory
 *   4. Feedback visual por arquivo (pending / processing / success / error / skipped)
 *   5. Detecção automática do CNPJ raiz após processamento
 *   6. Input manual para override do CNPJ raiz
 *   7. Log de processamento em tempo real
 *
 * LGPD: todos os XMLs são processados em memória do browser. Zero transmissão de dados.
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import {
  Upload, FileText, CheckCircle, XCircle, AlertCircle,
  Loader2, Lock, ChevronDown, ChevronUp, Building2,
} from 'lucide-react'
import { detectDocumentType } from '@/infrastructure/parsers/DocumentDetector'
import { parseDocument }       from '@/infrastructure/parsers/ParserFactory'
import { useFiscalStore }      from '@/application/store/useFiscalStore'
import { detectMainCnpjRoot }  from '@/application/services/TaxAnalyzerService'

import { Button }              from '@/components/ui/Button'

// ---------------------------------------------------------------------------
// TIPOS INTERNOS
// ---------------------------------------------------------------------------

type FileProgress = 'pending' | 'processing' | 'success' | 'error' | 'skipped'

interface FileStatus {
  id:        string       // filename usado como key
  filename:  string
  status:    FileProgress
  docType?:  string
  message?:  string
  count?:    number       // XMLs dentro de um ZIP
}

// ---------------------------------------------------------------------------
// ÍCONE POR STATUS
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: FileProgress }) {
  const size = 16
  if (status === 'processing') return <Loader2 size={size} style={{ color: 'var(--color-info)', animation: 'spin 1s linear infinite' }} />
  if (status === 'success')    return <CheckCircle size={size} style={{ color: 'var(--color-valid)' }} />
  if (status === 'error')      return <XCircle     size={size} style={{ color: 'var(--color-error)' }} />
  if (status === 'skipped')    return <AlertCircle size={size} style={{ color: 'var(--color-warn)' }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-border)' }} />
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export function UploadZone() {
  const [isDragging,   setIsDragging]   = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [cnpjInput,    setCnpjInput]    = useState('')
  const [showLog,      setShowLog]      = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const store = useFiscalStore()
  const logs  = useFiscalStore(s => s.logs)
  const docs  = useFiscalStore(s => s.documents)
  const cnpjRoot = useFiscalStore(s => s.analyzedCnpjRoot)
  const setCnpjRoot = useFiscalStore(s => s.setAnalyzedCnpjRoot)

  // ---------------------------------------------------------------------------
  // PROCESSAMENTO DE UM XML
  // ---------------------------------------------------------------------------

  const processXml = useCallback(async (
    xmlString: string, filename: string,
  ): Promise<{ success: boolean; docType?: string; message?: string }> => {
    const detection = detectDocumentType(xmlString, filename)
    store.addLogs(detection.logs)

    if (detection.type === 'UNKNOWN') {
      return { success: false, message: detection.logs[0]?.message ?? 'Tipo não reconhecido' }
    }

    const result = parseDocument(xmlString, detection.type, filename)
    store.addLogs(result.logs)

    if (!result.success || !result.document) {
      const msg = result.logs.find(l => l.level === 'FATAL' || l.level === 'ERROR')?.message
      return { success: false, message: msg ?? 'Erro no parsing' }
    }

    store.addDocument(result.document)
    return { success: true, docType: detection.type }
  }, [store])

  // ---------------------------------------------------------------------------
  // PROCESSAMENTO DO LOTE DE ARQUIVOS
  // ---------------------------------------------------------------------------

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0 || isProcessing) return

    setIsProcessing(true)
    store.setIsProcessing(true)

    // Inicializar statuses
    const statuses: FileStatus[] = files.map(f => ({
      id: f.name, filename: f.name, status: 'pending',
    }))
    setFileStatuses([...statuses])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const ext  = file.name.toLowerCase()

      // Marcar como processando
      statuses[i] = { ...statuses[i]!, status: 'processing' }
      setFileStatuses([...statuses])

      try {
        if (ext.endsWith('.zip')) {
          // --- ZIP: extrair e processar cada XML ---
          const zip      = await JSZip.loadAsync(file)
          const xmlFiles = Object.entries(zip.files)
            .filter(([name, entry]) => name.toLowerCase().endsWith('.xml') && !entry.dir)

          let successCount = 0
          let errorCount   = 0

          for (const [name, entry] of xmlFiles) {
            const content  = await entry.async('string')
            const basename = name.split('/').pop() ?? name
            const res      = await processXml(content, basename)
            if (res.success) successCount++
            else errorCount++
          }

          statuses[i] = {
            ...statuses[i]!,
            status:  errorCount === xmlFiles.length ? 'error' : 'success',
            message: `${successCount} processados${errorCount > 0 ? `, ${errorCount} com erro` : ''}`,
            count:   xmlFiles.length,
          }

        } else if (ext.endsWith('.xml')) {
          // --- XML avulso ---
          const content = await file.text()
          const res     = await processXml(content, file.name)
          statuses[i] = {
            ...statuses[i]!,
            status:  res.success ? 'success' : 'error',
            docType: res.docType,
            message: res.message,
          }

        } else {
          statuses[i] = { ...statuses[i]!, status: 'skipped', message: 'Formato não suportado (use .xml ou .zip)' }
        }

      } catch (err) {
        statuses[i] = { ...statuses[i]!, status: 'error', message: String(err) }
      }

      setFileStatuses([...statuses])
    }

    // --- Detecção automática do CNPJ raiz (se ainda não configurado) ---
    const currentDocs = useFiscalStore.getState().documents
    if (!useFiscalStore.getState().analyzedCnpjRoot && currentDocs.length > 0) {
      const detection = detectMainCnpjRoot(currentDocs)
      if (detection.cnpjRoot) {
        setCnpjRoot(detection.cnpjRoot)
      }
    }

    store.setIsProcessing(false)
    setIsProcessing(false)
  }, [isProcessing, processXml, store, setCnpjRoot])

  // ---------------------------------------------------------------------------
  // HANDLERS DE DRAG & DROP
  // ---------------------------------------------------------------------------

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files))
  }

  // ---------------------------------------------------------------------------
  // HANDLER DE CNPJ MANUAL
  // ---------------------------------------------------------------------------

  const applyManualCnpj = () => {
    const digits = cnpjInput.replace(/\D/g, '')
    if (digits.length >= 8) {
      setCnpjRoot(digits.slice(0, 8))
      setCnpjInput('')
    }
  }

  // ---------------------------------------------------------------------------
  // CONTADORES
  // ---------------------------------------------------------------------------

  const successCount = fileStatuses.filter(s => s.status === 'success').length
  const errorCount   = fileStatuses.filter(s => s.status === 'error').length

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px', margin: '0 auto' }}>

      {/* Drop Zone */}
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          background: isDragging ? 'var(--color-primary-light)' : 'var(--color-surface)',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xml,.zip"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        {isProcessing ? (
          <Loader2 size={36} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        ) : (
          <Upload size={36} style={{ color: isDragging ? 'var(--color-primary)' : 'var(--color-text-muted)', margin: '0 auto 12px' }} />
        )}
        <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
          {isProcessing ? 'Processando…' : isDragging ? 'Solte os arquivos aqui' : 'Arraste XMLs ou ZIPs aqui'}
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          Ou clique para selecionar • Aceita .xml e .zip
        </p>
      </div>

      {/* Aviso LGPD */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
        <Lock size={15} style={{ color: 'var(--color-info)', marginTop: '2px', flexShrink: 0 }} />
        <p style={{ fontSize: '0.8rem', color: '#0369a1', lineHeight: 1.5 }}>
          <strong>Privacidade garantida:</strong> seus XMLs são processados exclusivamente no navegador.
          Nenhum dado é enviado a servidores externos.
        </p>
      </div>

      {/* Progresso dos arquivos */}
      {fileStatuses.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Cabeçalho do progresso */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              PROCESSAMENTO — {fileStatuses.length} arquivo{fileStatuses.length !== 1 ? 's' : ''}
              {successCount > 0 && <span style={{ color: 'var(--color-valid)', marginLeft: '10px' }}>✓ {successCount}</span>}
              {errorCount   > 0 && <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>✗ {errorCount}</span>}
            </p>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {docs.length} doc{docs.length !== 1 ? 's' : ''} carregados
            </span>
          </div>

          {/* Lista de arquivos */}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {fileStatuses.map((fs) => (
              <div key={fs.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <StatusIcon status={fs.status} />
                <FileText size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fs.filename}
                </span>
                {fs.docType && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-info)', flexShrink: 0 }}>{fs.docType}</span>
                )}
                {fs.message && (
                  <span style={{ fontSize: '0.75rem', color: fs.status === 'error' ? 'var(--color-error)' : 'var(--color-text-muted)', flexShrink: 0, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fs.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CNPJ Analisado */}
      {(cnpjRoot || docs.length > 0) && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
            <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Empresa Analisada</p>
          </div>

          {cnpjRoot ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.9rem', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '6px', fontWeight: 500 }}>
                CNPJ Raiz: {cnpjRoot}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                (detectado automaticamente)
              </span>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              CNPJ raiz não detectado. Informe manualmente para calcular créditos e débitos.
            </p>
          )}

          {/* Input manual */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="CNPJ ou CNPJ raiz (8 dígitos)"
              value={cnpjInput}
              onChange={e => setCnpjInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyManualCnpj()}
              style={{
                flex: 1, height: '34px', padding: '0 12px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem', fontFamily: 'var(--font-data)',
                color: 'var(--color-text-primary)', background: 'var(--color-bg)',
              }}
            />
            <Button variant="primary" size="sm" onClick={applyManualCnpj} disabled={cnpjInput.replace(/\D/g, '').length < 8}>
              Aplicar
            </Button>
          </div>
        </div>
      )}

      {/* Log técnico (expansível) */}
      {logs.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <button
            onClick={() => setShowLog(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              LOG DE PROCESSAMENTO ({logs.length} entradas)
            </span>
            {showLog ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showLog && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px 16px 12px', borderTop: '1px solid var(--color-border)', fontFamily: 'var(--font-data)', fontSize: '0.75rem' }}>
              {logs.slice(0, 100).map((log, i) => (
                <div key={i} style={{
                  padding: '3px 0',
                  color: log.level === 'ERROR' || log.level === 'FATAL' ? 'var(--color-error)'
                       : log.level === 'WARN'  ? 'var(--color-warn)'
                       : 'var(--color-text-muted)',
                }}>
                  <span style={{ opacity: 0.6 }}>[{log.level}]</span> {log.source}: {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
