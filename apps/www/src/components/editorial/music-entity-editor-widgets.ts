import { EditorView, WidgetType } from '@codemirror/view'
import type { MusicEntityReference } from '@/components/editor/music-entity/music-entity-markdown'

export type MusicEntityWidget = {
  readonly key: string
  readonly host: HTMLElement
  readonly reference: MusicEntityReference
}

export type MusicEntityWidgetLifecycle = {
  readonly mount: (widget: MusicEntityWidget) => void
  readonly unmount: (host: HTMLElement) => void
}

export class ResolvedMusicEntityWidget extends WidgetType {
  private host: HTMLElement | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(
    readonly reference: MusicEntityReference,
    readonly from: number,
    readonly mount: MusicEntityWidgetLifecycle['mount'],
    readonly unmount: MusicEntityWidgetLifecycle['unmount']
  ) {
    super()
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof ResolvedMusicEntityWidget &&
      other.reference.type === this.reference.type &&
      other.reference.id === this.reference.id &&
      other.from === this.from
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('section')
    container.className = 'editorial-music-entity-widget'
    container.setAttribute('aria-label', 'Music entity embed')

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.className = 'editorial-music-entity-edit'
    editButton.textContent = 'Edit embed'
    editButton.addEventListener('click', () => {
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true })
      view.focus()
    })

    const host = document.createElement('div')
    host.className = 'editorial-music-entity-host'
    container.append(editButton, host)

    this.host = host
    this.mount({
      key: `${this.from}:${this.reference.type}:${this.reference.id}`,
      host,
      reference: this.reference
    })

    this.resizeObserver = new ResizeObserver(() => view.requestMeasure())
    this.resizeObserver.observe(host)
    return container
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    if (this.host) this.unmount(this.host)
    this.host = null
    this.resizeObserver = null
  }
}

export class PendingMusicEntityWidget extends WidgetType {
  constructor(readonly url: string) {
    super()
  }

  eq(other: WidgetType): boolean {
    return other instanceof PendingMusicEntityWidget && other.url === this.url
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'editorial-music-entity-pending'
    container.setAttribute('role', 'status')

    const spinner = document.createElement('span')
    spinner.className = 'editorial-music-entity-spinner'
    spinner.setAttribute('aria-hidden', 'true')

    const copy = document.createElement('span')
    copy.textContent = 'Adding Spotify music to the GBFM catalog…'

    container.append(spinner, copy)
    return container
  }
}
