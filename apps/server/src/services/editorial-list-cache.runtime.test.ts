import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Miniflare } from 'miniflare'
import { afterAll, beforeAll, expect, test } from 'vitest'

let runtime: Miniflare

let directory: string

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'gbfm-editorial-cache-'))
  const scriptPath = join(directory, 'worker.mjs')
  execFileSync('bun', [
    'build',
    'src/test/editorial-cache-worker.ts',
    '--target=browser',
    '--outfile',
    scriptPath,
  ])
  runtime = new Miniflare({
    workers: [
      {
        name: 'api',
        scriptPath,
        modulesRoot: directory,
        modules: true,
        compatibilityDate: '2026-07-04',
        compatibilityFlags: ['nodejs_compat'],
      },
      {
        name: 'frontend',
        modules: true,
        serviceBindings: { API: 'api' },
        script: `export default { fetch(request, env) {
          const url = new URL(request.url); url.hostname = 'api.internal';
          return env.API.fetch(new Request(url, request));
        } }`,
      },
    ],
  })
})

test('the same cache adapter works through a Worker service binding using the internal origin', async () => {
  const frontend = await runtime.getWorker('frontend')
  const url = 'https://frontend.example.com/service-binding-test'
  const body = '{"data":[],"pagination":{"total":0,"limit":20,"offset":0,"hasMore":false}}'
  expect((await frontend.fetch(url)).status).toBe(404)
  expect((await frontend.fetch(url, { method: 'PUT', body })).status).toBe(204)
  const cached = await frontend.fetch(url)
  expect(cached.status).toBe(200)
  expect(await cached.text()).toBe(body)
  expect((await frontend.fetch(url, { headers: { 'x-test-release': 'three' } })).status).toBe(404)
})

afterAll(async () => {
  await runtime?.dispose()

  if (directory) await rm(directory, { recursive: true, force: true })
})

test('the actual Cache API retains completed values across independent Worker invocations', async () => {
  const url = 'https://api.example.com/cache-test'
  const body = '{"data":[],"pagination":{"total":0,"limit":20,"offset":0,"hasMore":false}}'
  expect((await runtime.dispatchFetch(url)).status).toBe(404)
  expect((await runtime.dispatchFetch(url, { method: 'PUT', body })).status).toBe(204)
  const cached = await runtime.dispatchFetch(url)
  expect(cached.status).toBe(200)
  expect(await cached.text()).toBe(body)
  expect((await runtime.dispatchFetch(url + '?limit=10')).status).toBe(404)
  expect((await runtime.dispatchFetch(url, { headers: { 'x-test-release': 'two' } })).status).toBe(
    404,
  )
})
