#!/usr/bin/env bun
/**
 * D1Database implementation backed by the Cloudflare D1 REST API.
 *
 * Miniflare's D1 cannot reach a deployed database. This adapter satisfies the
 * D1Database interface against /d1/database/:id/query, so a plain script can
 * talk to real staging or production D1. seed-music-lookups.ts uses it.
 *
 * IMPORTANT: batch() is NOT atomic here. D1's REST API rejects bound
 * parameters alongside multi-statement SQL (error 7400), so each statement
 * becomes its own request and a partial failure leaves earlier statements
 * applied. Callers tolerate this by issuing only idempotent writes
 * (`INSERT OR REPLACE`), so re-running converges. Do not reuse this adapter
 * anywhere that depends on batch() rolling back.
 */

import type {
  D1Database,
  D1ExecResult,
  D1Meta,
  D1PreparedStatement,
  D1Result
} from '@cloudflare/workers-types'

type QueryResult = {
  readonly results?: ReadonlyArray<Record<string, unknown>>
  readonly success: boolean
  readonly meta: D1Meta & Record<string, unknown>
}

type ApiResponse = {
  readonly success: boolean
  readonly errors: ReadonlyArray<{ code: number; message: string }>
  readonly result: ReadonlyArray<QueryResult>
}

export type RemoteD1Options = {
  readonly accountId: string
  readonly apiToken: string
  readonly databaseId: string
}

const endpointFor = (options: RemoteD1Options) =>
  `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`

const post = async (
  options: RemoteD1Options,
  body: { sql: string; params?: ReadonlyArray<unknown> }
): Promise<ReadonlyArray<QueryResult>> => {
  const response = await fetch(endpointFor(options), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  /** `json()` resolves to `unknown`; this is the single HTTP decode boundary. */
  const payload = (await response.json()) as ApiResponse
  if (!response.ok || !payload.success) {
    const detail = (payload.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ')
    throw new Error(`D1 request failed (${response.status}): ${detail || 'unknown error'}`)
  }
  return payload.result
}

const toResult = <T>(result: QueryResult): D1Result<T> => ({
  /**
   * The REST API returns untyped JSON rows, so the caller's row type is
   * applied here at the single decode boundary rather than leaking `unknown`
   * into every query site.
   */
  results: (result.results ?? []) as Array<T>,
  success: true,
  meta: result.meta
})

/**
 * A statement that returns no rows still yields one result object. An empty
 * `result` array means the request itself returned nothing to interpret.
 */
const requireFirstResult = (results: ReadonlyArray<QueryResult>, sql: string): QueryResult => {
  const result = results[0]
  if (result === undefined) {
    throw new Error(`D1 returned no result for statement: ${sql.slice(0, 120)}`)
  }
  return result
}

class RemoteStatement implements D1PreparedStatement {
  readonly sql: string
  readonly params: ReadonlyArray<unknown>
  private readonly options: RemoteD1Options

  constructor(options: RemoteD1Options, sql: string, params: ReadonlyArray<unknown> = []) {
    this.options = options
    this.sql = sql
    this.params = params
  }

  bind(...params: Array<unknown>) {
    return new RemoteStatement(this.options, this.sql, params)
  }

  async all<T = Record<string, unknown>>() {
    const results = await post(this.options, { sql: this.sql, params: this.params })
    return toResult<T>(requireFirstResult(results, this.sql))
  }

  async run<T = Record<string, unknown>>() {
    return this.all<T>()
  }

  async first<T = unknown>(column?: string) {
    const { results } = await this.all<Record<string, unknown>>()
    const row = results[0]
    if (row === undefined) return null
    const value = column === undefined ? row : (row[column] ?? null)
    return value as T
  }

  async raw<T = Array<unknown>>(options?: { columnNames?: boolean }) {
    const { results } = await this.all<Record<string, unknown>>()
    const rows = results.map((row) => Object.values(row))
    if (options?.columnNames && results[0] !== undefined) {
      return [Object.keys(results[0]), ...rows] as T
    }
    return rows as T
  }
}

/**
 * How many parameterized statements are sent concurrently. D1 rejects bound
 * parameters alongside multi-statement SQL (error 7400), so each statement is
 * its own request and the batch's atomicity is lost -- acceptable here because
 * callers only issue idempotent `INSERT OR REPLACE` writes.
 */
const REQUEST_CONCURRENCY = 8

export const createRemoteD1 = (options: RemoteD1Options): D1Database => ({
  prepare: (sql: string) => new RemoteStatement(options, sql),

  batch: async <T = unknown>(statements: Array<D1PreparedStatement>) => {
    const remote = statements.filter((s) => s instanceof RemoteStatement)
    if (remote.length !== statements.length) {
      throw new Error('createRemoteD1().batch() only accepts statements from the same database')
    }

    const output: Array<D1Result<T>> = []
    for (let i = 0; i < remote.length; i += REQUEST_CONCURRENCY) {
      const window = remote.slice(i, i + REQUEST_CONCURRENCY)
      const settled = await Promise.all(
        window.map(async (statement) => {
          const results = await post(options, { sql: statement.sql, params: statement.params })
          return toResult<T>(requireFirstResult(results, statement.sql))
        })
      )
      output.push(...settled)
    }
    return output
  },

  exec: async (sql: string): Promise<D1ExecResult> => {
    const results = await post(options, { sql })
    const duration = results.reduce((total, result) => total + (result.meta?.duration ?? 0), 0)
    return { count: results.length, duration }
  },

  dump: () => {
    throw new Error('dump() is not available over the D1 REST API')
  },

  withSession: () => {
    throw new Error('withSession() is not available over the D1 REST API')
  }
})

export const remoteD1OptionsFromEnv = (): RemoteD1Options => {
  const accountId = process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const databaseId = process.env.D1_DATABASE_ID

  if (!accountId) throw new Error('CLOUDFLARE_DEFAULT_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID required')
  if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN required')
  if (!databaseId) throw new Error('D1_DATABASE_ID required')

  return { accountId, apiToken, databaseId }
}
