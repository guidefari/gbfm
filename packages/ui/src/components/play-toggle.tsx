import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react'
import type * as React from 'react'
import { cn } from '../lib/cn'

export const playbackStates = {
  idle: 'idle',
  loading: 'loading',
  playing: 'playing',
  error: 'error'
} as const

export type PlaybackState = (typeof playbackStates)[keyof typeof playbackStates]

const playToggleVariants = cva(
  'inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
  {
    variants: {
      variant: {
        icon: 'text-foreground/70 hover:text-highlight',
        button: 'gap-1.5 border px-2.5 py-1 text-base font-medium',
        hero: 'gap-1.5 rounded-sm bg-highlight px-3.5 py-1.5 font-medium text-highlight-foreground hover:opacity-90'
      },
      active: {
        true: '',
        false: ''
      }
    },
    compoundVariants: [
      {
        variant: 'button',
        active: true,
        className: 'border-highlight bg-highlight text-highlight-foreground'
      },
      {
        variant: 'button',
        active: false,
        className: 'border-border text-foreground/80 hover:border-highlight hover:text-highlight'
      },
      { variant: 'icon', active: true, className: 'text-highlight' }
    ],
    defaultVariants: {
      variant: 'icon',
      active: false
    }
  }
)

const iconSizes = { icon: 20, button: 14, hero: 18 } as const

const labelWidthReserve = ['play', 'pause', 'retry'] as const

export interface PlayToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  state: PlaybackState
  onToggle: () => void
  variant?: VariantProps<typeof playToggleVariants>['variant']
  label?: string
  showLabel?: boolean
}

function PlayToggle({
  state,
  onToggle,
  variant = 'icon',
  label,
  showLabel,
  className,
  disabled,
  ...props
}: PlayToggleProps) {
  const isPlaying = state === playbackStates.playing
  const isLoading = state === playbackStates.loading
  const isError = state === playbackStates.error

  const Icon = isError ? AlertCircle : isLoading ? Loader2 : isPlaying ? Pause : Play
  const size = iconSizes[variant ?? 'icon']
  const accessibleLabel = isError
    ? `Unable to play ${label ?? 'track'}`
    : isPlaying
      ? `Pause ${label ?? 'track'}`
      : `Play ${label ?? 'track'}`
  const visibleLabel = isError ? 'retry' : isPlaying ? 'pause' : 'play'

  const withLabel = showLabel ?? variant !== 'icon'

  return (
    <button
      type='button'
      onClick={onToggle}
      disabled={disabled || isLoading}
      aria-label={accessibleLabel}
      aria-busy={isLoading || undefined}
      data-state={state}
      className={cn(playToggleVariants({ variant, active: isPlaying }), className)}
      {...props}>
      <Icon
        size={size}
        fill={variant === 'icon' || isLoading || isError ? undefined : 'currentColor'}
        className={cn(isLoading && 'animate-spin', isError && 'text-destructive')}
      />
      {withLabel && (
        <span className='grid'>
          {labelWidthReserve.map((reserved) => (
            <span key={reserved} aria-hidden className='invisible col-start-1 row-start-1'>
              {reserved}
            </span>
          ))}
          <span className='col-start-1 row-start-1 text-left'>{visibleLabel}</span>
        </span>
      )}
    </button>
  )
}

export { PlayToggle, playToggleVariants }
