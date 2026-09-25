import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  VPS_PROXY_TARGET: {
    schema: (value) => value,
    description: 'Local development API proxy origin',
  },
  VITE_SPOTIFY_CLIENT_ID: {
    public: true,
    schema: (value) => value,
    description: 'Spotify OAuth client ID',
  },
})
