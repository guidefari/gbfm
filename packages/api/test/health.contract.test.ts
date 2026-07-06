import { describe, expect, test } from 'vitest'
import { Effect, Schema } from 'effect'
import { HttpApiClient } from 'effect/unstable/httpapi'
import { Api } from '../src/api'
import { isReadinessCheckFailedError, ReadinessCheckFailedError } from '../src/errors'
import { HealthGroup, HealthLiveResponse, HealthReadyResponse } from '../src/health'

describe('Health group contract', () => {
  test('declares live, ready, and check endpoints with root paths', () => {
    const { live, ready, check } = HealthGroup.endpoints
    expect(live).toBeDefined()
    expect(ready).toBeDefined()
    expect(check).toBeDefined()
    if (!live || !ready || !check) throw new Error('missing health endpoint')

    expect(live.method).toBe('GET')
    expect(live.path).toBe('/health/live')
    expect(ready.method).toBe('GET')
    expect(ready.path).toBe('/health/ready')
    expect(check.method).toBe('GET')
    expect(check.path).toBe('/health')
  })

  test('live endpoint declares no error', () => {
    const live = HealthGroup.endpoints.live
    expect(Array.from(live?.error ?? [])).toEqual([])
  })

  test('ready and check declare ReadinessCheckFailedError as their error schema', () => {
    for (const name of ['ready', 'check'] as const) {
      const errorSchemas = Array.from(HealthGroup.endpoints[name]?.error ?? [])
      expect(errorSchemas).toHaveLength(1)
      const err = new ReadinessCheckFailedError({ dbConnected: false })
      expect(Schema.is(ReadinessCheckFailedError)(err)).toBe(true)
      expect(err._tag).toBe('ReadinessCheckFailedError')
    }
  })

  test('live success decodes { ok: true } and rejects { ok: false }', () => {
    const bad: unknown = { ok: false }
    expect(Schema.decodeSync(HealthLiveResponse)({ ok: true })).toEqual({ ok: true })
    expect(() => Schema.decodeUnknownSync(HealthLiveResponse)(bad)).toThrow()
  })

  test('ready success decodes { dbConnected: true } and rejects false', () => {
    const bad: unknown = { dbConnected: false }
    expect(Schema.decodeSync(HealthReadyResponse)({ dbConnected: true })).toEqual({
      dbConnected: true
    })
    expect(() => Schema.decodeUnknownSync(HealthReadyResponse)(bad)).toThrow()
  })

  test('ReadinessCheckFailedError is tagged, carries dbConnected: false, and encodes with _tag', () => {
    const err = new ReadinessCheckFailedError({ dbConnected: false })
    expect(err._tag).toBe('ReadinessCheckFailedError')
    expect(err.dbConnected).toBe(false)
    expect(isReadinessCheckFailedError(err)).toBe(true)
    expect(Schema.encodeSync(ReadinessCheckFailedError)(err)).toMatchObject({
      _tag: 'ReadinessCheckFailedError',
      dbConnected: false
    })
  })

  test('Api composes the health group', () => {
    expect(Object.keys(Api.groups).sort()).toEqual(['health'])
    expect(Api.groups.health).toBe(HealthGroup)
  })

  test('HttpApiClient.ForApi exposes a typed health group with live/ready/check callables', () => {
    type Client = HttpApiClient.ForApi<typeof Api>
    type Health = Client['health']
    type IsCallable<K extends keyof Health> = Health[K] extends (
      ...args: never
    ) => Effect.Effect<unknown, unknown, unknown>
      ? true
      : false
    type Proof = [IsCallable<'live'>, IsCallable<'ready'>, IsCallable<'check'>]
    const proof: Proof = [true, true, true]
    expect(proof).toEqual([true, true, true])
  })
})
