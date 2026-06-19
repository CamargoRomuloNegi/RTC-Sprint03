/**
 * @file explorer/page.tsx  (rota "/explorer")
 * @description Explorador de documentos com filtros, tabela e modal de detalhes.
 */
'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react'
import { useFiscalStore }         from '@/application/store/useFiscalStore'
import { DocumentDetailsModal }   from '@/components/explorer/DocumentDetailsModal'
import { EmptyState }             from '@/components/ui/EmptyState'
import { docTypeBadge, directionBadge, regimeBadge } from '@/components/ui/Badge'
import { formatBRL, formatCnpjCpf, truncate } from '@/lib/utils'
import type { FiscalDocument, DocumentType, DocumentDirection, TaxRegime } from '@/domain/models/FiscalDocument'

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

type SortKey   = 'issue_date' | 'total_value' | 'document_type' | 'direction'
type SortOrder = 'asc' | 'desc'

interface Filters {
  search:    string
  docType:   DocumentType | 'ALL'
  direction: DocumentDirection | 'ALL'
  regime:    TaxRegime | 'ALL'
  hasIBS:    'ALL' | 'YES' | 'NO'
}

const DEFAULT_FILTERS: Filters = {
  search:'', docType:'ALL', direction:'ALL', regime:'ALL', hasIBS:'ALL',
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------

export default function ExplorerPage() {
  const documents = useFiscalStore(s => s.documents)
  const [filters, setFilters]           = useState<Filters>(DEFAULT_FILTERS)
  const [sortKey, setSortKey]           = useState<SortKey>('issue_date')
  const [sortOrder, setSortOrder]       = useState<SortOrder>('desc')
  const [selected, setSelected]         = useState<FiscalDocument | null>(null)
  const [showFilters, setShowFilters]   = useState(false)
  const [page, setPage]                 = useState(1)
  const PAGE_SIZE = 25

  // ---------------------------------------------------------------------------
  // FILTRAGEM
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    let result = documents

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(d =>
        d.access_key.includes(q) ||
        d.issuer.name.toLowerCase().includes(q) ||
        d.issuer.cnpj_cpf.includes(q) ||
        d.receiver.name.toLowerCase().includes(q)
      )
    }
    if (filters.docType   !== 'ALL') result = result.filter(d => d.document_type === filters.docType)
    if (filters.direction !== 'ALL') result = result.filter(d => d.direction      === filters.direction)
    if (filters.regime    !== 'ALL') result = result.filter(d => d.tax_regime     === filters.regime)
    if (filters.hasIBS    === 'YES') result = result.filter(d => (d.totals.vIBS??0)+(d.totals.vCBS??0) > 0)
    if (filters.hasIBS    === 'NO')  result = result.filter(d => (d.totals.vIBS??0)+(d.totals.vCBS??0) === 0)

    return result.slice().sort((a, b) => {
      let cmp = 0
      if (sortKey === 'issue_date')    cmp = a.issue_date.localeCompare(b.issue_date)
      if (sortKey === 'total_value')   cmp = a.total_value - b.total_value
      if (sortKey === 'document_type') cmp = a.document_type.localeCompare(b.document_type)
      if (sortKey === 'direction')     cmp = (a.direction??'').localeCompare(b.direction??'')
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [documents, filters, sortKey, sortOrder])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortOrder('desc') }
    setPage(1)
  }

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters(prev => ({ ...prev, [k]: v }))
    setPage(1)
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (documents.length === 0) {
    return <EmptyState variant="upload" title="Nenhum documento carregado" description="Vá para a tela de Upload e carregue seus XMLs fiscais para explorar." />
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'16px' }}>

      {/* Toolbar */}
      <div style={{ display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap' }}>
        {/* Busca */}
        <div style={{ position:'relative',flex:1,minWidth:'200px',maxWidth:'400px' }}>
          <Search size={14} style={{ position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--color-text-muted)',pointerEvents:'none' }} />
          <input
            type="text"
            placeholder="Buscar por CNPJ, nome ou chave…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            style={{ width:'100%',height:'34px',paddingLeft:'30px',paddingRight:'10px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',fontSize:'0.83rem',background:'var(--color-surface)',color:'var(--color-text-primary)',fontFamily:'var(--font-ui)' }}
          />
        </div>

        {/* Toggle filtros */}
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display:'flex',alignItems:'center',gap:'6px',height:'34px',padding:'0 12px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:showFilters?'var(--color-primary-light)':'var(--color-surface)',color:showFilters?'var(--color-primary)':'var(--color-text-secondary)',cursor:'pointer',fontSize:'0.82rem',fontWeight:500 }}
        >
          <SlidersHorizontal size={13} /> Filtros
        </button>

        <span style={{ fontSize:'0.8rem',color:'var(--color-text-muted)',marginLeft:'auto' }}>
          {filtered.length} de {documents.length} documentos
        </span>
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div style={{ display:'flex',gap:'10px',flexWrap:'wrap',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',padding:'14px 16px' }}>
          <FilterSelect label="Tipo"      value={filters.docType}   onChange={v => setFilter('docType',   v as Filters['docType'])}>
            <option value="ALL">Todos</option>
            <option value="NFE">NF-e</option><option value="NFCE">NFC-e</option>
            <option value="CTE">CT-e</option><option value="NFSE">NFS-e</option>
          </FilterSelect>
          <FilterSelect label="Direção"   value={filters.direction} onChange={v => setFilter('direction', v as Filters['direction'])}>
            <option value="ALL">Todas</option>
            <option value="INBOUND">Entrada</option><option value="OUTBOUND">Saída</option>
          </FilterSelect>
          <FilterSelect label="Regime"    value={filters.regime}    onChange={v => setFilter('regime',    v as Filters['regime'])}>
            <option value="ALL">Todos</option>
            <option value="RPA">RPA</option><option value="SIMPLES_NACIONAL">Simples</option><option value="MEI">MEI</option>
          </FilterSelect>
          <FilterSelect label="IBS/CBS"   value={filters.hasIBS}    onChange={v => setFilter('hasIBS',    v as Filters['hasIBS'])}>
            <option value="ALL">Todos</option>
            <option value="YES">Com IBS/CBS</option><option value="NO">Sem IBS/CBS</option>
          </FilterSelect>
          <button onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1) }} style={{ alignSelf:'flex-end',height:'30px',padding:'0 10px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:'none',cursor:'pointer',fontSize:'0.78rem',color:'var(--color-text-muted)' }}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <Th>Tipo</Th>
                <SortTh label="Direção"  k="direction"    current={sortKey} order={sortOrder} onClick={toggleSort} />
                <Th>Regime</Th>
                <SortTh label="Data"     k="issue_date"   current={sortKey} order={sortOrder} onClick={toggleSort} />
                <Th>Emitente</Th>
                <Th>Destinatário</Th>
                <SortTh label="Total"    k="total_value"  current={sortKey} order={sortOrder} onClick={toggleSort} />
                <Th>IBS</Th>
                <Th>CBS</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:'center',padding:'32px',color:'var(--color-text-muted)',fontSize:'0.85rem' }}>
                  Nenhum documento encontrado para os filtros aplicados.
                </td></tr>
              ) : paginated.map(doc => (
                <tr key={doc.access_key} onClick={() => setSelected(doc)} style={{ cursor:'pointer' }}>
                  <td>{docTypeBadge(doc.document_type)}</td>
                  <td>{directionBadge(doc.direction)}</td>
                  <td>{regimeBadge(doc.tax_regime)}</td>
                  <td style={{ fontFamily:'var(--font-data)',fontSize:'0.78rem',color:'var(--color-text-secondary)',whiteSpace:'nowrap' }}>{fmtDate(doc.issue_date)}</td>
                  <td>
                    <p style={{ fontSize:'0.82rem',fontWeight:500 }}>{truncate(doc.issuer.name, 28)}</p>
                    <p style={{ fontFamily:'var(--font-data)',fontSize:'0.72rem',color:'var(--color-text-muted)' }}>{formatCnpjCpf(doc.issuer.cnpj_cpf)}</p>
                  </td>
                  <td>
                    <p style={{ fontSize:'0.82rem' }}>{truncate(doc.receiver.name, 24)}</p>
                  </td>
                  <td style={{ fontFamily:'var(--font-data)',fontSize:'0.85rem',fontWeight:500,textAlign:'right',whiteSpace:'nowrap' }}>{formatBRL(doc.total_value)}</td>
                  <td style={{ fontFamily:'var(--font-data)',fontSize:'0.82rem',color:(doc.totals.vIBS??0)>0?'var(--color-credit-text)':'var(--color-text-muted)',textAlign:'right',whiteSpace:'nowrap' }}>
                    {(doc.totals.vIBS??0) > 0 ? formatBRL(doc.totals.vIBS!) : '—'}
                  </td>
                  <td style={{ fontFamily:'var(--font-data)',fontSize:'0.82rem',color:(doc.totals.vCBS??0)>0?'var(--color-credit-text)':'var(--color-text-muted)',textAlign:'right',whiteSpace:'nowrap' }}>
                    {(doc.totals.vCBS??0) > 0 ? formatBRL(doc.totals.vCBS!) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderTop:'1px solid var(--color-border)',background:'var(--color-bg)' }}>
            <span style={{ fontSize:'0.78rem',color:'var(--color-text-muted)' }}>
              Página {page} de {totalPages}
            </span>
            <div style={{ display:'flex',gap:'4px' }}>
              {Array.from({ length:Math.min(totalPages,7) }, (_,i) => i+1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ width:'28px',height:'28px',borderRadius:'4px',border:'1px solid var(--color-border)',background:p===page?'var(--color-primary)':'var(--color-surface)',color:p===page?'#fff':'var(--color-text-secondary)',cursor:'pointer',fontSize:'0.78rem',fontWeight:p===page?600:400 }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && <DocumentDetailsModal document={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTES
// ---------------------------------------------------------------------------

function Th({ children }:{ children:React.ReactNode }) {
  return <th>{children}</th>
}

function SortTh({ label,k,current,order,onClick }:{ label:string;k:SortKey;current:SortKey;order:SortOrder;onClick:(k:SortKey)=>void }) {
  const active = current === k
  return (
    <th style={{ cursor:'pointer',userSelect:'none' }} onClick={() => onClick(k)}>
      <span style={{ display:'inline-flex',alignItems:'center',gap:'4px',color:active?'var(--color-primary)':undefined }}>
        {label}
        {active ? (order==='desc'?<ChevronDown size={12}/>:<ChevronUp size={12}/>) : <ChevronDown size={12} style={{ opacity:0.3 }}/>}
      </span>
    </th>
  )
}

function FilterSelect({ label,value,onChange,children }:{ label:string;value:string;onChange:(v:string)=>void;children:React.ReactNode }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'4px' }}>
      <label style={{ fontSize:'0.7rem',fontWeight:600,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.05em' }}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ height:'30px',padding:'0 8px',border:'1px solid var(--color-border)',borderRadius:'var(--radius-sm)',background:'var(--color-bg)',fontSize:'0.82rem',color:'var(--color-text-primary)',fontFamily:'var(--font-ui)' }}>
        {children}
      </select>
    </div>
  )
}

function fmtDate(iso:string):string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) } catch { return '—' }
}
