import { Badge, Button, cn } from '@gbfm/ui'
import { useEffect, useState } from 'react'
import { ComponentPreview } from './component-examples'
import {
  navItems,
  type PanelId,
  type Theme,
  themes,
  type ViewportPresetId,
  viewportPresets
} from './playground-data'
import { PreviewFrame } from './preview-frame'
import { ViewportControls } from './viewport-controls'

function App() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [activeViewport, setActiveViewport] =
    useState<ViewportPresetId>('desktop')
  const [customWidth, setCustomWidth] = useState(960)

  const viewport = viewportPresets.find(
    (preset) => preset.id === activeViewport
  )

  const previewWidth =
    activeViewport === 'custom' ? customWidth : (viewport?.width ?? customWidth)
  const previewHeight = viewport?.height ?? 760
  const previewLabel =
    previewWidth === '100%' ? 'full width' : `${previewWidth}px`
  const activeItem = navItems.find((item) => item.id === activePanel)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main
      data-theme={theme}
      className='h-screen overflow-hidden bg-background text-foreground'>
      <div className='grid h-screen overflow-hidden lg:grid-cols-[280px_1fr]'>
        <aside className='workshop-scrollbar border-b border-border bg-card/60 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0'>
          <div className='flex h-full flex-col gap-8 p-5'>
            <div className='space-y-4'>
              <Badge variant='outline'>@gbfm/ui</Badge>
              <div>
                <h1 className='text-2xl font-bold tracking-tight'>
                  UI Workshop
                </h1>
                <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                  Component review, theme checks, and responsive stress tests.
                </p>
              </div>
            </div>

            <nav className='space-y-2' aria-label='Component sections'>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => setActivePanel(item.id)}
                  className={cn(
                    'w-full rounded-sm border px-3 py-3 text-left transition hover:border-highlight hover:bg-accent',
                    activePanel === item.id
                      ? 'border-highlight bg-accent text-highlight'
                      : 'border-transparent text-muted-foreground'
                  )}>
                  <span className='block text-sm font-semibold text-foreground'>
                    {item.label}
                  </span>
                  <span className='mt-1 block text-xs leading-5'>
                    {item.description}
                  </span>
                </button>
              ))}
            </nav>

            <div className='mt-auto space-y-3'>
              <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
                Theme
              </p>
              <div className='grid grid-cols-3 gap-2 lg:grid-cols-1'>
                {themes.map((themeName) => (
                  <Button
                    key={themeName}
                    type='button'
                    size='sm'
                    variant={theme === themeName ? 'default' : 'outline'}
                    onClick={() => setTheme(themeName)}>
                    {themeName}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className='flex min-w-0 flex-col overflow-hidden bg-background'>
          <header className='shrink-0 border-b border-border bg-background/95 px-5 py-4'>
            <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
              <div className='space-y-1'>
                <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
                  Reviewing
                </p>
                <h2 className='text-2xl font-semibold tracking-tight'>
                  {activeItem?.label}
                </h2>
              </div>
              <ViewportControls
                activeViewport={activeViewport}
                customWidth={customWidth}
                previewLabel={previewLabel}
                previewWidth={previewWidth}
                onViewportChange={setActiveViewport}
                onCustomWidthChange={setCustomWidth}
              />
            </div>
          </header>

          <div className='min-h-0 flex-1 p-5'>
            <div className='flex h-full min-h-0 flex-col rounded-sm border border-border bg-card p-3 shadow-xl'>
              <div className='mb-3 flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground'>
                <span>{previewLabel} viewport</span>
                <span>{theme} theme</span>
              </div>
              <div className='workshop-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-sm bg-muted/50 p-4'>
                <PreviewFrame
                  theme={theme}
                  width={previewWidth}
                  height={previewHeight}>
                  <ComponentPreview panel={activePanel} />
                </PreviewFrame>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export { App }
