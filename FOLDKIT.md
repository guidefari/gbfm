# Foldkit in GBFM

The WWW app uses Foldkit 0.163.0 (`apps/www/package.json`). Before changing its runtime or navigation, compare the installed `node_modules/foldkit` source and `@foldkit/vite-plugin` with the current [Foldkit AI overview](https://foldkit.dev/ai/overview). The website offers Markdown at `/ai/overview.md` and an index at `/llms.txt`. Do not assume examples from `main` match this installed release.

The Model owns state, Messages describe events, `update` returns a Model and Commands, and `view` describes the UI. Runtime owns external work through Commands, Subscriptions, Mounts, Flags, Resources, and ManagedResource. Follow a navigation from `apps/www/src/entry.client.ts` through `apps/www/src/update.ts` and `apps/www/src/command.ts`, then into `apps/www/src/entry.server.ts` for server data requests. Keep side effects out of `view` and stateful behavior in the owning submodel.

For a slow transition, separate browser navigation time, WWW request time, API spans, and client rendering. Local WWW and API traces go to Jaeger (`https://jaeger.localhost`); search `gbfm.request_id` and compare with the response `x-request-id`. Local request summaries are in Grafana's Loki datasource. A slow SSR trace alone does not prove the same delay in a client transition.

Foldkit also offers [agent skills](https://foldkit.dev/ai/skills) and a [DevTools MCP](https://foldkit.dev/ai/mcp) for Model and Message history. This repo has not yet vendored the pinned framework source or installed that MCP. Use the installed packages and version-matched docs now; add the subtree or runtime bridge only when the extra tooling earns its maintenance cost.
