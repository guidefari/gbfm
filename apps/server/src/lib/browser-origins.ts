const staticBrowserOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3003',
  'http://localhost:3003',
  'https://gbfm.localhost',
  'https://gbfm.test',
  'https://www.goosebumps.fm',
  'https://goosebumps.fm',
] as const

export const browserOrigins = (frontend: string): Array<string> => [
  ...new Set([frontend, ...staticBrowserOrigins]),
]
