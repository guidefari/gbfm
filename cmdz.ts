import { Command } from 'cmdz'

export default [
  Command('Alchemy', { command: 'bun run dev:alchemy' }),
  Command('Web', { command: 'bun run dev', cwd: 'apps/www' }),
  Command('Mobile', { command: 'bun run start -- --lan', cwd: 'apps/mobile', autostart: false }),
  Command('UI Playground', { command: 'bun run dev', cwd: 'packages/ui', autostart: false }),
  Command('Email Preview', { command: 'bun run dev', cwd: 'packages/email', autostart: false }),
  Command('Jaeger', { command: 'bun run dev:otel', autostart: false }),
]
