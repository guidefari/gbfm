#!/usr/bin/env bun

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
  readonly error?: string
  readonly meta: D1Meta & Record<string, unknown>
}

type Query = { readonly sql: string; readonly params?: ReadonlyArray<unknown> }
type QueryBody = Query | { readonly batch: ReadonlyArray<Query> }

type ApiResponse = {
  readonly success: boolean
  readonly errors: ReadonlyArray<{ code: number; message: string }>
  readonly result: ReadonlyArray<QueryResult>
}

type RemoteFetch = (url: string, init: RequestInit) => Promise<Response>

export type RemoteD1Options = {
  readonly accountId: string
  readonly apiToken: string
  readonly databaseId: string
  readonly fetch?: RemoteFetch
}

const endpointFor = (options: RemoteD1Options) =>
  `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`

const post = async (
  options: RemoteD1Options,
  body: QueryBody
): Promise<ReadonlyArray<QueryResult>> => {
  const response = await (options.fetch ?? fetch)(endpointFor(options), {
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
  for (const [index, result] of payload.result.entries()) {
    if (!result.success) {
      throw new Error(`D1 statement ${index} failed: ${result.error ?? 'unknown error'}`)
    }
  }
  return payload.result
}

const toResult = <T>(result: QueryResult): D1Result<T> => ({
  /** The REST API returns untyped rows; the prepared statement supplies their boundary type. */
  results: (result.results ?? []) as Array<T>,
  success: true,
  meta: result.meta
})

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

export const createRemoteD1 = (options: RemoteD1Options): D1Database => ({
  prepare: (sql: string) => new RemoteStatement(options, sql),

  batch: async <T = unknown>(statements: Array<D1PreparedStatement>) => {
    const remote = statements.filter((s) => s instanceof RemoteStatement)
    if (remote.length !== statements.length) {
      throw new Error('createRemoteD1().batch() only accepts statements from the same database')
    }

    if (remote.length === 0) return []
    const results = await post(options, {
      batch: remote.map((statement) => ({ sql: statement.sql, params: statement.params }))
    })
    if (results.length !== remote.length) {
      throw new Error(`D1 batch returned ${results.length} results for ${remote.length} statements`)
    }
    return results.map((result) => toResult<T>(result))
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
