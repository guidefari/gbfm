import { Command } from '@effect/platform'
import { BunSocketServer } from '@effect/platform-bun'
import { Effect } from 'effect'

export const checkPortAvailable = (port: number) =>
  Effect.scoped(BunSocketServer.make({ port, host: '0.0.0.0' }))

export const lsofPort = (port: number) =>
  Command.string(
    Command.make('lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN')
  ).pipe(
    Effect.map((output) => output.trim()),
    Effect.catchAll(() => Effect.succeed(''))
  )

export const formatLsofTable = (raw: string): string | null => {
  const lines = raw.split('\n').filter(Boolean)
  if (lines.length < 2) return null

  const rows = lines.map((line) => line.split(/\s+/))
  const colCount = Math.max(...rows.map((r) => r.length))
  const widths = Array.from({ length: colCount }, (_, i) =>
    Math.max(...rows.map((r) => (r[i] ?? '').length))
  )
  const fmt = (r: string[]) =>
    widths.map((w, i) => (r[i] ?? '').padEnd(w)).join('  ')
  const [header, ...body] = rows
  const sep = widths.map((w) => '-'.repeat(w)).join('  ')
  return [fmt(header ?? []), sep, ...body.map(fmt)].join('\n')
}
