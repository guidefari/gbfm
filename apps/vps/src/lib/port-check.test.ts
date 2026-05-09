import { BunContext, BunSocketServer } from '@effect/platform-bun'
import { Effect, Exit } from 'effect'
import { describe, expect, test } from 'vitest'
import { checkPortAvailable, formatLsofTable, lsofPort } from './port-check'

const randomPort = () => 40000 + Math.floor(Math.random() * 20000)

describe('formatLsofTable', () => {
  test('returns null for empty input', () => {
    expect(formatLsofTable('')).toBeNull()
  })

  test('returns null for header-only input', () => {
    expect(formatLsofTable('COMMAND PID USER')).toBeNull()
  })

  test('formats header, separator, and rows with aligned columns', () => {
    const raw = ['COMMAND PID USER NAME', 'bun 47754 guidefari *:3003'].join(
      '\n'
    )

    const result = formatLsofTable(raw)
    expect(result).not.toBeNull()
    const lines = (result as string).split('\n')

    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('COMMAND  PID    USER       NAME  ')
    expect(lines[1]).toBe('-------  -----  ---------  ------')
    expect(lines[2]).toBe('bun      47754  guidefari  *:3003')
  })

  test('pads short rows when later rows have more columns', () => {
    const raw = ['A B', 'x y z'].join('\n')
    const result = formatLsofTable(raw)
    const lines = (result as string).split('\n')
    expect(lines[0]).toBe('A  B   ')
    expect(lines[2]).toBe('x  y  z')
  })

  test('ignores blank lines', () => {
    const raw = ['HDR VAL', '', 'a b', ''].join('\n')
    const result = formatLsofTable(raw)
    const lines = (result as string).split('\n')
    expect(lines).toHaveLength(3)
  })
})

describe('checkPortAvailable', () => {
  test('succeeds on a free port', async () => {
    const port = randomPort()
    const exit = await Effect.runPromiseExit(
      checkPortAvailable(port).pipe(Effect.asVoid)
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  test('fails with SocketServerError when port is busy', async () => {
    const port = randomPort()

    const program = Effect.scoped(
      Effect.gen(function* () {
        yield* BunSocketServer.make({ port, host: '0.0.0.0' })
        return yield* Effect.exit(checkPortAvailable(port).pipe(Effect.asVoid))
      })
    )

    const exit = await Effect.runPromise(program)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      expect(exit.cause.error._tag).toBe('SocketServerError')
    }
  })
})

describe('lsofPort', () => {
  test('returns empty string for a free port', async () => {
    const port = randomPort()
    const result = await Effect.runPromise(
      lsofPort(port).pipe(Effect.provide(BunContext.layer))
    )
    expect(result).toBe('')
  })

  test('returns process info for a busy port', async () => {
    const port = randomPort()
    const program = Effect.scoped(
      Effect.gen(function* () {
        yield* BunSocketServer.make({ port, host: '0.0.0.0' })
        return yield* lsofPort(port)
      })
    ).pipe(Effect.provide(BunContext.layer))

    const result = await Effect.runPromise(program)
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain(String(port))
  })
})
