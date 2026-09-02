The API runs as a Cloudflare Worker on D1. There is no standalone Bun server
process: the Bun/Postgres entrypoint was retired once the Worker became
production.

To install dependencies:

```sh
bun install
```

To run the stack locally, from the repo root:

```sh
bun run dev
```

That opens the Turborepo terminal UI and runs `alchemy dev`, which owns the Worker, its bindings, and the Vite website process. Use `bun run dev:full` to include the optional mobile, UI playground, email preview, and local observability tasks.

Tests:

```sh
cd apps/server
bun run test
```
