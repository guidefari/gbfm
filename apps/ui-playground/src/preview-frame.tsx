import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Theme } from './playground-data'

interface PreviewFrameProps {
  theme: Theme
  width: number | '100%'
  height: number | '100%'
  children: ReactNode
}

function PreviewFrame({ theme, width, height, children }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    const documentElement = iframe?.contentDocument

    if (!iframe || !documentElement) return

    const syncFrame = () => {
      documentElement.head.replaceChildren(
        ...Array.from(
          document.querySelectorAll('style, link[rel="stylesheet"]')
        ).map((node) => node.cloneNode(true))
      )

      documentElement.documentElement.dataset.theme = theme
      documentElement.body.dataset.theme = theme
      documentElement.body.style.margin = '0'
      documentElement.body.style.minHeight = '100vh'
      documentElement.documentElement.classList.add('workshop-scrollbar')
      documentElement.body.classList.add('workshop-scrollbar')

      let root = documentElement.getElementById('preview-root')

      if (!root) {
        root = documentElement.createElement('div')
        root.id = 'preview-root'
        documentElement.body.append(root)
      }

      setMountNode(root)
    }

    syncFrame()
    iframe.addEventListener('load', syncFrame)

    return () => iframe.removeEventListener('load', syncFrame)
  }, [theme])

  useEffect(() => {
    const documentElement = iframeRef.current?.contentDocument

    if (!documentElement) return

    documentElement.documentElement.dataset.theme = theme
    documentElement.body.dataset.theme = theme
  }, [theme])

  return (
    <div className={width === '100%' ? 'h-full w-full' : 'h-full min-w-max'}>
      <iframe
        ref={iframeRef}
        title='Component preview viewport'
        className='block rounded-sm border border-border bg-background shadow-2xl'
        style={{ width, height, maxHeight: '100%' }}
      />
      {mountNode && createPortal(children, mountNode)}
    </div>
  )
}

export { PreviewFrame }
