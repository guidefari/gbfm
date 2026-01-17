import { vi } from 'vitest'

vi.mock('sst', () => ({
  Resource: {
    App: { stage: 'dev' },
    Email: { sender: 'test@test.com' },
    BETTER_AUTH_SECRET: { value: 'test-secret' },
    BETTER_AUTH_URL: { value: 'http://localhost:3000' },
    Urls: { site: 'http://localhost:5173' },
    SpotifyClientId: { value: 'test-client-id' },
    SpotifyClientSecret: { value: 'test-client-secret' }
  }
}))
