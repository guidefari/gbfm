import { isPrivateMediaPath } from '@gbfm/core/media-preview'
import { Option, Schema } from 'effect'

const PreviewResponse = Schema.Struct({
  sessionUrl: Schema.String,
  grant: Schema.String,
  expiresAt: Schema.Number,
})

/** Only the reserved private namespace opts into credentialed media requests. */
export const isPrivateMedia = (value: string): boolean => {
  try {
    const url = new URL(value)

    return url.protocol === 'https:' && isPrivateMediaPath(url.pathname)
  } catch {
    return false
  }
}

export type PreviewResult = { readonly ok: true } | { readonly ok: false }

export type PreviewSession = {
  ensure(): Promise<PreviewResult>
  dispose(): void
}

/** Owns one active path, never the media element or its src. No token is retained. */
export const createPreviewSession = (
  url: string,
  dependencies: {
    readonly fetch: typeof fetch
    readonly now: () => number
    readonly onDenied: () => void
    readonly document?: Pick<Document, 'addEventListener' | 'removeEventListener'> & {
      readonly visibilityState?: DocumentVisibilityState
    }
    readonly window?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  },
): PreviewSession => {
  const controller = new AbortController()
  let pending: Promise<PreviewResult> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let expiresAt = 0
  let lastAttempt = -Infinity

  const request = async (): Promise<PreviewResult> => {
    try {
      const response = await dependencies.fetch('/api/upload/preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Preview denied')
      const parsed = Schema.decodeUnknownOption(PreviewResponse)(await response.json())

      if (Option.isNone(parsed)) throw new Error('Invalid preview response')
      const grant = parsed.value
      const endpoint = new URL(grant.sessionUrl)
      const media = new URL(url)

      if (
        endpoint.origin !== media.origin ||
        endpoint.pathname !== '/preview-session' ||
        endpoint.search !== '' ||
        endpoint.hash !== '' ||
        !Number.isFinite(grant.expiresAt) ||
        grant.expiresAt <= dependencies.now()
      )
        throw new Error('Invalid preview response')

      const installed = await dependencies.fetch(endpoint.href, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant: grant.grant }),
        signal: controller.signal,
      })

      if (!installed.ok) throw new Error('Preview denied')

      if (controller.signal.aborted) return { ok: false }
      expiresAt = grant.expiresAt
      timer = setTimeout(
        () => {
          void refresh()
        },
        Math.max(5_000, expiresAt - dependencies.now() - 180_000),
      )

      return { ok: true }
    } catch {
      expiresAt = 0

      if (!controller.signal.aborted) dependencies.onDenied()

      return { ok: false }
    }
  }

  const refresh = (): Promise<PreviewResult> => {
    if (controller.signal.aborted) return Promise.resolve({ ok: false })

    if (pending) return pending

    // Resume events often arrive together. Denials never create an automatic retry loop.
    if (dependencies.now() - lastAttempt < 5_000)
      return Promise.resolve({ ok: expiresAt > dependencies.now() })
    lastAttempt = dependencies.now()
    clearTimeout(timer)
    pending = request().finally(() => {
      pending = undefined
    })

    return pending
  }

  const resume = () => {
    if (dependencies.document?.visibilityState !== 'hidden') void refresh()
  }

  dependencies.document?.addEventListener('visibilitychange', resume)
  dependencies.window?.addEventListener('online', resume)

  return {
    ensure: () =>
      pending ?? (expiresAt > dependencies.now() ? Promise.resolve({ ok: true }) : refresh()),
    dispose: () => {
      controller.abort()
      clearTimeout(timer)
      dependencies.document?.removeEventListener('visibilitychange', resume)
      dependencies.window?.removeEventListener('online', resume)
    },
  }
}

export const previewDeniedEvent = 'gbfm:media-preview-denied'

export const browserPreviewSession = (url: string, onDenied?: () => void) =>
  createPreviewSession(url, {
    fetch: (...args) => fetch(...args),
    now: Date.now,
    document,
    window,
    onDenied: () => {
      onDenied?.()
      window.dispatchEvent(new Event(previewDeniedEvent))
    },
  })
