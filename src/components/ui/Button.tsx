/**
 * @file Button.tsx
 * @description Botão com variantes primary, secondary e danger.
 * Suporta ícone à esquerda, estado de loading e disabled.
 */
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: React.ReactNode
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  disabled?: boolean
  icon?:     React.ReactNode
  onClick?:  () => void
  type?:     'button' | 'submit'
  fullWidth?: boolean
}

const STYLES: Record<ButtonVariant, { bg: string; color: string; border: string; hover: string }> = {
  primary:   { bg: 'var(--color-primary)',   color: '#fff',                        border: 'transparent', hover: 'var(--color-primary-hover)' },
  secondary: { bg: 'var(--color-surface)',   color: 'var(--color-text-primary)',   border: 'var(--color-border)', hover: 'var(--color-bg)' },
  danger:    { bg: '#fef2f2',               color: 'var(--color-error)',           border: '#fecaca',     hover: '#fee2e2' },
  ghost:     { bg: 'transparent',           color: 'var(--color-text-secondary)',  border: 'transparent', hover: 'var(--color-bg)' },
}

const SIZES: Record<ButtonSize, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: '0 12px', fontSize: '0.8rem',  height: '30px' },
  md: { padding: '0 16px', fontSize: '0.875rem', height: '36px' },
  lg: { padding: '0 20px', fontSize: '0.9rem',  height: '42px' },
}

export function Button({
  children, variant = 'secondary', size = 'md',
  loading, disabled, icon, onClick, type = 'button', fullWidth,
}: ButtonProps) {
  const s   = STYLES[variant]
  const sz  = SIZES[size]
  const dis = disabled || loading

  return (
    <button
      type={type}
      disabled={dis}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: '6px', height: sz.height, padding: sz.padding,
        fontSize: sz.fontSize, fontWeight: 500, fontFamily: 'var(--font-ui)',
        borderRadius: 'var(--radius-sm)', cursor: dis ? 'not-allowed' : 'pointer',
        border: `1px solid ${s.border}`, backgroundColor: s.bg, color: s.color,
        opacity: dis ? 0.55 : 1, transition: 'background 0.15s',
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!dis) (e.currentTarget as HTMLButtonElement).style.background = s.hover }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = s.bg }}
    >
      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {children}
    </button>
  )
}
