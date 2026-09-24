import { describe, expect, test } from 'vitest'
import { resolveApiOrigin } from './api-origin'

describe('API origin', () => {
  test('uses the configured server target instead of assuming the frontend port', () => {
    expect(
      resolveApiOrigin({
        publicBaseUrl: '',
        serverProxyTarget: 'https://api.example.com',
        browserOrigin: undefined
      })
    ).toBe('https://api.example.com')
  })

  test('uses the browser origin for same-origin API requests', () => {
    expect(
      resolveApiOrigin({
        publicBaseUrl: '',
        serverProxyTarget: undefined,
        browserOrigin: 'https://www.example.com'
      })
    ).toBe('https://www.example.com')
  })

  test('prefers the deployed API origin over runtime fallbacks', () => {
    expect(
      resolveApiOrigin({
        publicBaseUrl: 'https://api.example.com',
        serverProxyTarget: 'http://127.0.0.1:8787',
        browserOrigin: 'https://www.example.com'
      })
    ).toBe('https://api.example.com')
  })

  test('falls back to the local API port during unconfigured server rendering', () => {
    expect(
      resolveApiOrigin({
        publicBaseUrl: '',
        serverProxyTarget: undefined,
        browserOrigin: undefined
      })
    ).toBe('http://127.0.0.1:3003')
  })
})
