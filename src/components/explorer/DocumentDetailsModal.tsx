/**
 * @file DocumentDetailsModal.tsx
 * @description Modal lateral com todos os detalhes de um documento fiscal.
 *
 * Exibe três seções:
 *   1. Cabeçalho: chave, tipo, datas, participantes, regime
 *   2. Tributos por Item: legados (ICMS/PIS/COFINS/ISS) + RTC (IBS/CBS)
 *   3. Totais do documento
 *
 * Para CT-e: aviso de que os tributos do item[0] são do documento inteiro.
 */
'use client'

import { X, AlertCircle, ExternalLink } from 'lucide-react'
import type { FiscalDocument, DocumentItem } from '@/domain/models/FiscalDocument'
import { docTypeBadge, directionBadge, regimeBadge, rtcImpactBadge, statusBadge, Badge } from '@/components/ui/Badge'
import { formatBRL, formatCnpjCpf } from '@/lib/utils'

interface Props { document: FiscalDocument; onClose: () => void }

export function DocumentDetailsModal({ document: doc, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:40,backdropFilter:'blur(2px)' }} />
      <div style={{ position:'fixed',right:0,top:0,bottom:0,width:'680px',maxWidth:'95vw',background:'var(--color-surface)',boxShadow:'-4px 0 32px rgba(0,0,0,0.15)',zIndex:50,display:'flex',flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--color-border)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:'8px' }}>
            {docTypeBadge(doc.document_type)}
            {directionBadge(doc.direction)}
            {statusBadge(doc.status)}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--color-text-muted)',padding:'4px',borderRadius:'6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:'20px' }}>

          {/* Chave */}
          <div style={{ background:'var(--color-bg)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontFamily:'var(--font-data)',fontSize:'0.72rem',color:'var(--color-text-secondary)',wordBreak:'break-all',letterSpacing:'0.04em' }}>
            {doc.access_key}
          </div>

          {/* Meta */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px' }}>
            <Field label="Data Emissão"  value={fmt(doc.issue_date)} />
            <Field label="Finalidade"    value={doc.purpose} />
            <Field label="Regime"        node={regimeBadge(doc.tax_regime)} />
            <Field label="Valor Total"   value={formatBRL(doc.total_value)} mono />
            {doc.competency_date && <Field label="Competência" value={fmt(doc.competency_date)} />}
          </div>

          {/* Participantes */}
          <Sec title="Participantes">
            <Pax label="Emitente / Prestador"    p={doc.issuer} />
            <Pax label="Destinatário / Tomador"  p={doc.receiver} />
            {doc.sender && <Pax label="Remetente" p={doc.sender} />}
          </Sec>

          {/* Aviso CT-e */}
          {doc.document_type === 'CTE' && (
            <div style={{ display:'flex',gap:'8px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'var(--radius-md)',padding:'10px 14px' }}>
              <AlertCircle size={14} style={{ color:'var(--color-warn)',flexShrink:0,marginTop:'2px' }} />
              <p style={{ fontSize:'0.78rem',color:'#92400e',lineHeight:1.5 }}>
                CT-e: tributos no nível do documento — associados ao componente 1.
              </p>
            </div>
          )}

          {/* Itens */}
          <Sec title={`Itens (${doc.items.length})`}>
            {doc.items.map(item => <ItemRow key={item.item_number} item={item} docType={doc.document_type} />)}
          </Sec>

          {/* Totais */}
          <Sec title="Totais do Documento">
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1px',background:'var(--color-border)' }}>
              {totalsRows(doc).map(({ label,value,rtc }) => (
                <div key={label} style={{ padding:'10px 12px',background:rtc?'var(--color-credit-light)':'var(--color-surface)' }}>
                  <p style={{ fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.05em',color:rtc?'var(--color-credit-text)':'var(--color-text-muted)',fontWeight:600,marginBottom:'3px' }}>{label}</p>
                  <p style={{ fontFamily:'var(--font-data)',fontSize:'0.88rem',fontWeight:600,color:rtc?'var(--color-credit-text)':'var(--color-text-primary)' }}>{formatBRL(value??0)}</p>
                </div>
              ))}
            </div>
          </Sec>

          {/* Chaves NF-e referenciadas */}
          {doc.referenced_keys && doc.referenced_keys.length > 0 && (
            <Sec title={`NF-es Referenciadas (${doc.referenced_keys.length})`}>
              {doc.referenced_keys.map(k => (
                <div key={k} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 14px',borderBottom:'1px solid var(--color-border)',fontFamily:'var(--font-data)',fontSize:'0.72rem',color:'var(--color-text-muted)' }}>
                  <ExternalLink size={11} />{k}
                </div>
              ))}
            </Sec>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS / SUB-COMPONENTES
// ---------------------------------------------------------------------------

function Sec({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--color-text-muted)',marginBottom:'8px' }}>{title}</p>
      <div style={{ background:'var(--color-bg)',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1px solid var(--color-border)' }}>{children}</div>
    </div>
  )
}

function Field({ label,value,node,mono }:{ label:string;value?:string;node?:React.ReactNode;mono?:boolean }) {
  return (
    <div>
      <p style={{ fontSize:'0.7rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--color-text-muted)',marginBottom:'3px' }}>{label}</p>
      {node ?? <p style={{ fontSize:'0.85rem',color:'var(--color-text-primary)',fontFamily:mono?'var(--font-data)':undefined }}>{value||'—'}</p>}
    </div>
  )
}

function Pax({ label,p }:{ label:string;p:{cnpj_cpf:string;name:string;ie?:string;uf?:string} }) {
  return (
    <div style={{ padding:'10px 14px',borderBottom:'1px solid var(--color-border)' }}>
      <p style={{ fontSize:'0.7rem',color:'var(--color-text-muted)',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.05em' }}>{label}</p>
      <p style={{ fontSize:'0.85rem',fontWeight:500,color:'var(--color-text-primary)' }}>{p.name}</p>
      <div style={{ display:'flex',gap:'12px',marginTop:'3px' }}>
        <span style={{ fontFamily:'var(--font-data)',fontSize:'0.75rem',color:'var(--color-text-secondary)' }}>{formatCnpjCpf(p.cnpj_cpf)}</span>
        {p.uf && <span style={{ fontSize:'0.75rem',color:'var(--color-text-muted)' }}>UF: {p.uf}</span>}
      </div>
    </div>
  )
}

function ItemRow({ item,docType:_docType }:{ item:DocumentItem;docType:string }) {
  const hasRTC = (item.rtc.vIBS??0)+(item.rtc.vCBS??0)>0
  return (
    <div style={{ padding:'12px 14px',borderBottom:'1px solid var(--color-border)' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'8px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'8px',flex:1,minWidth:0 }}>
          <span style={{ fontSize:'0.72rem',fontFamily:'var(--font-data)',color:'var(--color-text-muted)',flexShrink:0 }}>#{String(item.item_number).padStart(2,'0')}</span>
          <span style={{ fontSize:'0.85rem',color:'var(--color-text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.description}</span>
        </div>
        <div style={{ display:'flex',gap:'6px',flexShrink:0 }}>
          {item.cfop && <Badge variant="neutral" label={`CFOP ${item.cfop}`} />}
          {item.rtc_impact && rtcImpactBadge(item.rtc_impact)}
        </div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'8px' }}>
        <MV label="Valor Líq." value={formatBRL(item.net_value)} />
        {(item.taxes_current.icms_value??0)>0  && <MV label="ICMS"   value={formatBRL(item.taxes_current.icms_value!)} muted />}
        {(item.taxes_current.pis_value??0)>0   && <MV label="PIS"    value={formatBRL(item.taxes_current.pis_value!)} muted />}
        {(item.taxes_current.cofins_value??0)>0 && <MV label="COFINS" value={formatBRL(item.taxes_current.cofins_value!)} muted />}
        {(item.taxes_current.iss_value??0)>0   && <MV label="ISS"    value={formatBRL(item.taxes_current.iss_value!)} muted />}
        {hasRTC && <>
          {item.rtc.vBC!==undefined  && <MV label="Base IBS/CBS" value={formatBRL(item.rtc.vBC)} rtc />}
          {item.rtc.vIBS!==undefined && <MV label="IBS Total"    value={formatBRL(item.rtc.vIBS)} rtc />}
          {item.rtc.vCBS!==undefined && <MV label="CBS"          value={formatBRL(item.rtc.vCBS)} rtc />}
          {item.rtc.cst              && <MV label="CST RTC"       value={item.rtc.cst} rtc />}
        </>}
        {!hasRTC && <span style={{ fontSize:'0.74rem',color:'var(--color-text-muted)',fontStyle:'italic',gridColumn:'1/-1' }}>Sem campos IBS/CBS</span>}
      </div>
    </div>
  )
}

function MV({ label,value,muted,rtc }:{ label:string;value:string;muted?:boolean;rtc?:boolean }) {
  return (
    <div>
      <p style={{ fontSize:'0.67rem',textTransform:'uppercase',letterSpacing:'0.04em',color:rtc?'var(--color-credit-text)':'var(--color-text-muted)',fontWeight:600,marginBottom:'2px' }}>{label}</p>
      <p style={{ fontFamily:'var(--font-data)',fontSize:'0.82rem',fontWeight:rtc?600:400,color:rtc?'var(--color-credit-text)':muted?'var(--color-text-secondary)':'var(--color-text-primary)' }}>{value}</p>
    </div>
  )
}

function totalsRows(doc: FiscalDocument) {
  const t = doc.totals
  const hasRTC = (t.vIBS??0)+(t.vCBS??0)>0
  return [
    { label:'Produtos/Serviços',value:t.vProd,       show:true },
    { label:'Descontos',        value:t.vDesc,        show:!!t.vDesc },
    { label:'Frete',            value:t.vFrete,       show:!!t.vFrete },
    { label:'ICMS',             value:t.vICMS,        show:!!t.vICMS },
    { label:'ISS',              value:t.vISS,         show:!!t.vISS },
    { label:'Total Trib.',      value:t.vTotTrib,     show:!!t.vTotTrib },
    { label:'Base IBS/CBS',     value:t.vBCIBSCBS,    show:hasRTC, rtc:true },
    { label:'IBS Total',        value:t.vIBS,         show:hasRTC, rtc:true },
    { label:'CBS Total',        value:t.vCBS,         show:hasRTC, rtc:true },
  ].filter(r=>r.show)
}

function fmt(iso:string):string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) } catch { return iso }
}
