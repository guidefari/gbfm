<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { onMount } from 'svelte'

  type TelemetryEvent = {
    kind: 'navigation' | 'web-vital' | 'ui-error' | 'player'
    name: string
    value?: number
    route?: string
  }

  const send = (event: TelemetryEvent) => {
    const body = JSON.stringify(event)

    if (!navigator.sendBeacon('/telemetry/browser', body)) {
      void fetch('/telemetry/browser', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  let startedAt = performance.now()

  afterNavigate(({ to }) => {
    send({
      kind: 'navigation',
      name: 'route-complete',
      route: to?.url.pathname ?? location.pathname,
      value: Math.round(performance.now() - startedAt),
    })
    startedAt = performance.now()
  })

  onMount(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        send({
          kind: 'web-vital',
          name: entry.entryType,
          route: location.pathname,
          value: Math.round(entry.startTime),
        })
      }
    })

    observer.observe({ type: 'largest-contentful-paint', buffered: true })

    const reportError = () =>
      send({ kind: 'ui-error', name: 'uncaught-error', route: location.pathname })

    window.addEventListener('error', reportError)
    window.addEventListener('unhandledrejection', reportError)

    return () => {
      observer.disconnect()
      window.removeEventListener('error', reportError)
      window.removeEventListener('unhandledrejection', reportError)
    }
  })
</script>
