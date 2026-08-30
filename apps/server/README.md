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

That starts `alchemy dev`, which serves the Worker and its bindings.

Tests:

```sh
cd apps/server
bun run test
```
