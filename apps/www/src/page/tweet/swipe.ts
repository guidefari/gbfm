import {
  beginReaderSwipe,
  finishReaderSwipe,
  moveReaderSwipe,
  type ReaderSwipe,
} from '@gbfm/core/reader-swipe'

const excluded =
  'a, button, summary, details, input, textarea, select, [contenteditable], img, video, audio, iframe, [role="slider"], [data-swipe-exclude]'

type ActiveSwipe = {
  readonly gesture: ReaderSwipe
  readonly identifier: number
  readonly path: string
  readonly slug: string
  readonly surface: Element
}

const point = (event: TouchEvent, touch: Touch, ending = false) => ({
  x: touch.clientX,
  y: touch.clientY,
  time: event.timeStamp,
  pointers: ending ? (event.touches.length === 0 ? 1 : 0) : event.touches.length,
})

export const startTweetSwipes = () => {
  let active: ActiveSwipe | null = null
  let pendingSlug: string | null = null

  const clear = () => {
    active = null
  }

  const navigationEnded = () => {
    pendingSlug = null
  }

  const reset = () => {
    clear()
    pendingSlug = null
  }

  const start = (event: TouchEvent) => {
    clear()

    if (
      event.touches.length !== 1 ||
      !(event.target instanceof Element) ||
      event.target.closest(excluded)
    )
      return

    if (document.querySelector('dialog[open], :popover-open, details[data-tweet-dock][open]'))
      return

    const surface = event.target.closest('[data-tweet-swipe]')
    const slug = surface?.getAttribute('data-tweet-swipe')
    const touch = event.touches[0]

    if (!surface || !slug || !touch) return

    if (surface.getAttribute('data-swipe-ready') !== 'true') return

    if (pendingSlug === slug || location.pathname !== `/tweet/${encodeURIComponent(slug)}`) return

    pendingSlug = null

    const gesture = beginReaderSwipe(point(event, touch), innerWidth)

    if (gesture)
      active = { gesture, identifier: touch.identifier, path: location.pathname, slug, surface }
  }

  const move = (event: TouchEvent) => {
    if (!active) return

    const touch = Array.from(event.touches).find((touch) => touch.identifier === active?.identifier)
    const gesture = touch ? moveReaderSwipe(active.gesture, point(event, touch)) : null

    if (!gesture) {
      clear()

      return
    }

    active = { ...active, gesture }

    if (gesture.axis === 'horizontal' && event.cancelable) event.preventDefault()
  }

  const end = (event: TouchEvent) => {
    const current = active
    clear()

    if (
      !current ||
      pendingSlug === current.slug ||
      current.path !== location.pathname ||
      !current.surface.isConnected ||
      current.surface.getAttribute('data-tweet-swipe') !== current.slug
    )
      return

    if (window.getSelection()?.isCollapsed === false) return

    const touch = Array.from(event.changedTouches).find(
      (touch) => touch.identifier === current.identifier,
    )

    const direction = touch ? finishReaderSwipe(current.gesture, point(event, touch, true)) : null
    const link = direction ? document.getElementById(`tweet-${direction}`) : null

    if (!(link instanceof HTMLAnchorElement)) return

    if (event.cancelable) event.preventDefault()

    pendingSlug = current.slug
    link.click()
  }

  document.addEventListener('touchstart', start, { passive: true })
  document.addEventListener('touchmove', move, { passive: false })
  document.addEventListener('touchend', end, { passive: false })
  document.addEventListener('touchcancel', clear, { passive: true })
  window.addEventListener('blur', reset)
  window.addEventListener('gbfm:navigation-end', navigationEnded)
  window.addEventListener('popstate', reset)

  return () => {
    document.removeEventListener('touchstart', start)
    document.removeEventListener('touchmove', move)
    document.removeEventListener('touchend', end)
    document.removeEventListener('touchcancel', clear)
    window.removeEventListener('blur', reset)
    window.removeEventListener('gbfm:navigation-end', navigationEnded)
    window.removeEventListener('popstate', reset)
  }
}
