/**
 * @file Card.tsx
 * @description Container de card com título, badge e conteúdo.
 * Base visual para todas as seções de conteúdo da aplicação.
 */
interface CardProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  noPadding?: boolean
}

export function Card({ title, subtitle, actions, children, noPadding }: CardProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            {title && <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{title}</p>}
            {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{actions}</div>}
        </div>
      )}
      <div style={noPadding ? {} : { padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}
