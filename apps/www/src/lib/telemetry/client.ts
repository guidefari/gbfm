import {
  MAX_BATCH_EVENTS,
  TELEMETRY_VERSION,
  type BrowserTelemetryBatch,
  type BrowserTelemetryEvent,
} from './contract'

export const TELEMETRY_SAMPLE_RATE = 0.1

const FLUSH_DELAY_MS = 5_000

export function isSampled(session: string, rate: number = TELEMETRY_SAMPLE_RATE): boolean {
  let hash = 0

  for (const character of session) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0

  return hash / 0x1_0000_0000 < rate
}

type Transport = {
  readonly beacon: (body: string) => boolean
  readonly fetch: (body: string) => Promise<void>
}

export function createTelemetryBatcher(input: {
  readonly session: string
  readonly release: string
  readonly sampleRate?: number
  readonly transport: Transport
  readonly now?: () => number
  readonly schedule?: (flush: () => void, delay: number) => void
}) {
  let events: Array<BrowserTelemetryEvent> = []
  let scheduled = false
  const now = input.now ?? Date.now
  const schedule = input.schedule ?? ((flush, delay) => globalThis.setTimeout(flush, delay))

  const flush = () => {
    scheduled = false

    if (events.length === 0) return

    const batch: BrowserTelemetryBatch = {
      version: TELEMETRY_VERSION,
      session: input.session,
      release: input.release,
      sampleRate: input.sampleRate ?? TELEMETRY_SAMPLE_RATE,
      sentAt: now(),
      events,
    }

    events = []
    const body = JSON.stringify(batch)

    if (!input.transport.beacon(body)) void input.transport.fetch(body).catch(() => undefined)
  }

  return {
    add(event: BrowserTelemetryEvent) {
      events.push(event)

      if (events.length >= MAX_BATCH_EVENTS) flush()
      else if (!scheduled) {
        scheduled = true
        schedule(flush, FLUSH_DELAY_MS)
      }
    },
    flush,
  }
}

const PLAYER_EVENT = 'gbfm:player-telemetry'

export type PlayerTelemetryName = 'play' | 'pause' | 'stall' | 'error'

export const reportPlayerTelemetry = (name: PlayerTelemetryName): void => {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(PLAYER_EVENT, { detail: name }))
}

export const listenForPlayerTelemetry = (
  listener: (name: PlayerTelemetryName) => void,
): (() => void) => {
  const onEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) return

    const name: unknown = event.detail

    if (name === 'play' || name === 'pause' || name === 'stall' || name === 'error') listener(name)
  }

  window.addEventListener(PLAYER_EVENT, onEvent)

  return () => window.removeEventListener(PLAYER_EVENT, onEvent)
}
