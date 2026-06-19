/**
 * @file Badge.tsx
 * @description Componente de badge semântico para tipos de documento, direção, impacto RTC e regime.
 * Cada variante tem cor e label padronizados para consistência visual em toda a aplicação.
 */
import type { DocumentType, DocumentDirection, RtcImpact, TaxRegime, DocumentStatus } from '@/domain/models/FiscalDocument'

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

type BadgeVariant = 'credit' | 'debit' | 'neutral' | 'inbound' | 'outbound' | 'unknown'
  | 'nfe' | 'nfce' | 'cte' | 'nfse'
  | 'rpa' | 'simples' | 'mei'
  | 'valid' | 'partial' | 'error'

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  size?: 'sm' | 'md'
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DE ESTILOS POR VARIANTE
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  credit:   { bg: 'var(--color-credit-light)',  color: 'var(--color-credit-text)',   border: '#a7f3d0' },
  debit:    { bg: 'var(--color-debit-light)',   color: 'var(--color-debit-text)',    border: '#fecaca' },
  neutral:  { bg: 'var(--color-neutral-light)', color: 'var(--color-neutral-text)',  border: '#cbd5e1' },
  inbound:  { bg: '#eff6ff',                    color: '#1d4ed8',                    border: '#bfdbfe' },
  outbound: { bg: '#faf5ff',                    color: '#7c3aed',                    border: '#ddd6fe' },
  unknown:  { bg: '#f9fafb',                    color: '#6b7280',                    border: '#e5e7eb' },
  nfe:      { bg: '#f0f9ff',                    color: '#0369a1',                    border: '#bae6fd' },
  nfce:     { bg: '#f0fdfa',                    color: '#0f766e',                    border: '#99f6e4' },
  cte:      { bg: '#fff7ed',                    color: '#c2410c',                    border: '#fed7aa' },
  nfse:     { bg: '#fdf4ff',                    color: '#9333ea',                    border: '#e9d5ff' },
  rpa:      { bg: '#f0fdf4',                    color: '#166534',                    border: '#bbf7d0' },
  simples:  { bg: '#fefce8',                    color: '#854d0e',                    border: '#fef08a' },
  mei:      { bg: '#fff7ed',                    color: '#9a3412',                    border: '#fed7aa' },
  valid:    { bg: '#f0fdf4',                    color: '#166534',                    border: '#bbf7d0' },
  partial:  { bg: '#fffbeb',                    color: '#92400e',                    border: '#fde68a' },
  error:    { bg: '#fef2f2',                    color: '#991b1b',                    border: '#fecaca' },
}

const VARIANT_LABELS: Record<BadgeVariant, string> = {
  credit:   'CRÉDITO', debit: 'DÉBITO', neutral: 'NEUTRO',
  inbound:  'ENTRADA', outbound: 'SAÍDA', unknown: 'INDEFINIDO',
  nfe:      'NF-e', nfce: 'NFC-e', cte: 'CT-e', nfse: 'NFS-e',
  rpa:      'RPA', simples: 'SIMPLES', mei: 'MEI',
  valid:    'VÁLIDO', partial: 'PARCIAL', error: 'ERRO',
}

// ---------------------------------------------------------------------------
// COMPONENTE
// ---------------------------------------------------------------------------

export function Badge({ variant, label, size = 'sm' }: BadgeProps) {
  const styles = VARIANT_STYLES[variant]
  const text   = label ?? VARIANT_LABELS[variant]
  const pad    = size === 'sm' ? '2px 7px' : '4px 10px'
  const fs     = size === 'sm' ? '0.68rem'  : '0.75rem'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: pad, borderRadius: '4px', fontSize: fs,
      fontWeight: 600, letterSpacing: '0.04em',
      fontFamily: 'var(--font-ui)',
      backgroundColor: styles.bg, color: styles.color,
      border: `1px solid ${styles.border}`,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// FUNÇÕES AUXILIARES — convertem enums do domínio em variantes de badge
// ---------------------------------------------------------------------------

export function rtcImpactBadge(impact: RtcImpact | undefined) {
  if (!impact) return <Badge variant="neutral" label="—" />
  const map: Record<RtcImpact, BadgeVariant> = { CREDIT: 'credit', DEBIT: 'debit', NEUTRAL: 'neutral' }
  return <Badge variant={map[impact]} />
}

export function directionBadge(dir: DocumentDirection | undefined) {
  if (!dir || dir === 'UNKNOWN') return <Badge variant="unknown" label="—" />
  const map: Record<DocumentDirection, BadgeVariant> = { INBOUND: 'inbound', OUTBOUND: 'outbound', UNKNOWN: 'unknown' }
  return <Badge variant={map[dir]} />
}

export function docTypeBadge(type: DocumentType) {
  const map: Record<DocumentType, BadgeVariant> = { NFE: 'nfe', NFCE: 'nfce', CTE: 'cte', NFSE: 'nfse', UNKNOWN: 'neutral' }
  return <Badge variant={map[type] ?? 'neutral'} />
}

export function regimeBadge(regime: TaxRegime) {
  const map: Record<TaxRegime, BadgeVariant> = { RPA: 'rpa', SIMPLES_NACIONAL: 'simples', MEI: 'mei', UNKNOWN: 'neutral' }
  return <Badge variant={map[regime] ?? 'neutral'} />
}

export function statusBadge(status: DocumentStatus) {
  const map: Record<DocumentStatus, BadgeVariant> = { VALID: 'valid', PARTIAL: 'partial', SCHEMA_ERROR: 'error' }
  return <Badge variant={map[status] ?? 'neutral'} />
}
