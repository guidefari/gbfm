import { Button, Input } from '@gbfm/ui'
import { type ViewportPresetId, viewportPresets } from './playground-data'

interface ViewportControlsProps {
  activeViewport: ViewportPresetId
  customWidth: number
  previewLabel: string
  previewWidth: number | '100%'
  onViewportChange: (viewport: ViewportPresetId) => void
  onCustomWidthChange: (width: number) => void
}

function ViewportControls({
  activeViewport,
  customWidth,
  previewLabel,
  previewWidth,
  onViewportChange,
  onCustomWidthChange
}: ViewportControlsProps) {
  return (
    <div className='flex flex-col gap-3 rounded-sm border border-border bg-card p-3 xl:min-w-[560px]'>
      <div className='flex flex-wrap items-center gap-2'>
        {viewportPresets.map((preset) => (
          <Button
            key={preset.id}
            type='button'
            size='sm'
            variant={activeViewport === preset.id ? 'default' : 'outline'}
            onClick={() => onViewportChange(preset.id)}>
            {preset.label}
          </Button>
        ))}
        <span className='ml-auto text-sm text-muted-foreground'>
          {previewLabel}
        </span>
      </div>

      <div className='grid gap-3 md:grid-cols-[1fr_100px]'>
        <input
          type='range'
          min='320'
          max='1440'
          step='10'
          value={customWidth}
          disabled={previewWidth === '100%'}
          onChange={(event) => {
            onViewportChange('custom')
            onCustomWidthChange(Number(event.currentTarget.value))
          }}
          className='w-full accent-[var(--highlight)] disabled:opacity-40'
          aria-label='Custom viewport width'
        />
        <Input
          type='number'
          min={320}
          max={1440}
          value={customWidth}
          disabled={previewWidth === '100%'}
          onChange={(event) => {
            onViewportChange('custom')
            onCustomWidthChange(Number(event.currentTarget.value))
          }}
          aria-label='Custom viewport width in pixels'
        />
      </div>
    </div>
  )
}

export { ViewportControls }
