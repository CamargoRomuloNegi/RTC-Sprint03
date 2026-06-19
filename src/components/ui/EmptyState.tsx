/**
 * @file EmptyState.tsx
 * @description Estado vazio padronizado com ícone, título e instrução de ação.
 * Usado quando não há documentos carregados ou filtros retornam zero resultados.
 */
import { FileUp, FileSearch, AlertTriangle } from 'lucide-react'

type EmptyVariant = 'upload' | 'filter' | 'warning'

interface EmptyStateProps {
  variant?: EmptyVariant
  title: string
  description?: string
  action?: React.ReactNode
}

const ICONS: Record<EmptyVariant, React.ReactNode> = {
  upload:  <FileUp   size={36} style={{ color: 'var(--color-text-muted)' }} />,
  filter:  <FileSearch size={36} style={{ color: 'var(--color-text-muted)' }} />,
  warning: <AlertTriangle size={36} style={{ color: 'var(--color-warn)' }} />,
}

export function EmptyState({ variant = 'upload', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
      gap: '12px',
    }}>
      {ICONS[variant]}
      <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>{title}</p>
      {description && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '360px', lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
