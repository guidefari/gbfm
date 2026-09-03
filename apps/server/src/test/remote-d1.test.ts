import { describe, expect, test } from 'vitest'
import { createRemoteD1, type RemoteD1Options } from '../../scripts/remote-d1'

const options = (fetchImplementation: NonNullable<RemoteD1Options['fetch']>) => ({
  accountId: 'account',
  apiToken: 'token',
  databaseId: 'database',
  fetch: fetchImplementation
})

type RemoteResult = {
  readonly success: boolean
  readonly results: ReadonlyArray<never>
  readonly meta: { readonly changes?: number }
  readonly error?: string
}

const response = (result: ReadonlyArray<RemoteResult>) =>
  new Response(JSON.stringify({ success: true, errors: [], result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

describe('remote D1 adapter', () => {
  test('sends parameterized statements in one REST batch request', async () => {
    const bodies: string[] = []
    const recordingFetch: NonNullable<RemoteD1Options['fetch']> = async (_input, init) => {
      bodies.push(await new Response(init.body).text())
      return response([
        { success: true, results: [], meta: { changes: 1 } },
        { success: true, results: [], meta: { changes: 1 } }
      ])
    }
    const database = createRemoteD1(options(recordingFetch))

    await database.batch([
      database.prepare('INSERT INTO one VALUES (?)').bind('one'),
      database.prepare('INSERT INTO two VALUES (?)').bind('two')
    ])

    expect(bodies).toEqual([
      JSON.stringify({
        batch: [
          { sql: 'INSERT INTO one VALUES (?)', params: ['one'] },
          { sql: 'INSERT INTO two VALUES (?)', params: ['two'] }
        ]
      })
    ])
  })

  test('rejects a failed result even when the response envelope succeeds', async () => {
    const failedFetch: NonNullable<RemoteD1Options['fetch']> = async () =>
      response([{ success: false, error: 'constraint failed', results: [], meta: {} }])
    const database = createRemoteD1(options(failedFetch))

    await expect(database.prepare('SELECT 1').all()).rejects.toThrow(
      'D1 statement 0 failed: constraint failed'
    )
  })

  test('validates every result in a batch', async () => {
    const partiallyFailedFetch: NonNullable<RemoteD1Options['fetch']> = async () =>
      response([
        { success: true, results: [], meta: {} },
        { success: false, error: 'second failed', results: [], meta: {} }
      ])
    const database = createRemoteD1(options(partiallyFailedFetch))

    await expect(
      database.batch([database.prepare('SELECT 1'), database.prepare('SELECT 2')])
    ).rejects.toThrow('D1 statement 1 failed: second failed')
  })
})
