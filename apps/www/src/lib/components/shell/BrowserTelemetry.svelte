<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { Option, Schema } from 'effect'
  import { onMount } from 'svelte'

  import {
    createTelemetryBatcher,
    isSampled,
    listenForPlayerTelemetry,
    TELEMETRY_SAMPLE_RATE,
  } from '@/lib/telemetry/client'
  import type { BrowserTelemetryEvent } from '@/lib/telemetry/contract'
  import { boundedName, errorFingerprint, routeTemplate } from '@/lib/telemetry/privacy'
  import { anonymousSession } from '@/lib/telemetry/session'

  let navigationStartedAt: number | undefined

  let initialNavigation = true

  let add: ReturnType<typeof createTelemetryBatcher>['add'] | undefined

  let pendingNavigation: BrowserTelemetryEvent | undefined

  let currentRoute = '/unknown'

  let vitalRoute = '/unknown'

  const LayoutShiftEntry = Schema.Struct({
    hadRecentInput: Schema.Boolean,
    value: Schema.Number,
  })

  const InteractionEntry = Schema.Struct({
    interactionId: Schema.Number,
    duration: Schema.Number,
  })

  beforeNavigate(() => {
    navigationStartedAt = performance.now()
  })

  afterNavigate(({ to }) => {
    const initial = initialNavigation
    initialNavigation = false
    currentRoute = routeTemplate(
      to?.route.id ?? page.route.id,
      to?.url.pathname ?? location.pathname,
    )

    if (initial) vitalRoute = currentRoute

    const event: BrowserTelemetryEvent = {
      kind: 'navigation',
      name: initial ? 'initial-load' : 'spa-navigation',
      route: currentRoute,
      value: Math.round(
        initial
          ? performance.now()
          : performance.now() - (navigationStartedAt ?? performance.now()),
      ),
    }

    if (add) add(event)
    else pendingNavigation = event
    navigationStartedAt = undefined
  })

  onMount(() => {
    const session = anonymousSession(localStorage, Date.now())

    const release = boundedName(
      document.querySelector<HTMLMetaElement>('meta[name="gbfm-release"]')?.content ?? 'unknown',
      'unknown',
    )

    const sampleRate = release === 'local' ? 1 : TELEMETRY_SAMPLE_RATE

    if (!isSampled(session, sampleRate)) return

    const batcher = createTelemetryBatcher({
      session,
      release,
      sampleRate,
      transport: {
        beacon: (body) => navigator.sendBeacon('/telemetry/browser', body),
        fetch: (body) =>
          fetch('/telemetry/browser', {
            method: 'POST',
            body,
            keepalive: true,
            headers: { 'content-type': 'application/json' },
          }).then(() => undefined),
      },
    })

    add = batcher.add

    if (pendingNavigation) {
      add(pendingNavigation)
      pendingNavigation = undefined
    }

    let lcp = 0
    let cls = 0
    let inp = 0
    const observers: Array<PerformanceObserver> = []

    const observe = (type: string, consume: (entry: PerformanceEntry) => void) => {
      try {
        const observer = new PerformanceObserver((list) => list.getEntries().forEach(consume))
        observer.observe({ type, buffered: true })
        observers.push(observer)
      } catch {
        // Older browsers may not support every web-vital entry type.
      }
    }

    observe('largest-contentful-paint', (entry) => {
      lcp = entry.startTime
    })
    observe('layout-shift', (entry) => {
      const shift = Option.getOrUndefined(Schema.decodeUnknownOption(LayoutShiftEntry)(entry))

      if (shift && !shift.hadRecentInput) cls += shift.value
    })
    observe('event', (entry) => {
      const interaction = Option.getOrUndefined(Schema.decodeUnknownOption(InteractionEntry)(entry))

      if (interaction && interaction.interactionId > 0) inp = Math.max(inp, interaction.duration)
    })

    let finalized = false

    const finalize = () => {
      if (finalized) return
      finalized = true
      const route = vitalRoute

      if (lcp > 0) batcher.add({ kind: 'web-vital', name: 'lcp', route, value: Math.round(lcp) })
      batcher.add({ kind: 'web-vital', name: 'cls', route, value: Math.round(cls * 1_000) / 1_000 })

      if (inp > 0) batcher.add({ kind: 'web-vital', name: 'inp', route, value: Math.round(inp) })
      batcher.flush()
    }

    const visibility = () => {
      if (document.visibilityState === 'hidden') finalize()
    }

    const reportError = (event: ErrorEvent) =>
      batcher.add({
        kind: 'ui-error',
        name: errorFingerprint(event.error ?? event.message, 'error'),
        route: currentRoute,
      })

    const reportRejection = (event: PromiseRejectionEvent) =>
      batcher.add({
        kind: 'ui-error',
        name: errorFingerprint(
          event.reason instanceof Error ? event.reason : 'unknown-rejection',
          'rejection',
        ),
        route: currentRoute,
      })

    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', finalize)
    window.addEventListener('error', reportError)
    window.addEventListener('unhandledrejection', reportRejection)

    const stopPlayerTelemetry = listenForPlayerTelemetry((name) =>
      batcher.add({ kind: 'player', name, route: currentRoute }),
    )

    return () => {
      finalize()
      observers.forEach((observer) => observer.disconnect())
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', finalize)
      window.removeEventListener('error', reportError)
      window.removeEventListener('unhandledrejection', reportRejection)
      stopPlayerTelemetry()
      add = undefined
    }
  })
</script>

<span hidden data-browser-telemetry></span>
