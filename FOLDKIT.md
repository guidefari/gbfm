# Foldkit in GBFM

The WWW app uses Foldkit 0.163.0 (`apps/www/package.json`). Before changing its runtime or navigation, compare the installed `node_modules/foldkit` source and `@foldkit/vite-plugin` with the current [Foldkit AI overview](https://foldkit.dev/ai/overview). The website offers Markdown at `/ai/overview.md` and an index at `/llms.txt`. Do not assume examples from `main` match this installed release.

The Model owns state, Messages describe events, `update` returns a Model and Commands, and `view` describes the UI. Runtime owns external work through Commands, Subscriptions, Mounts, Flags, Resources, and ManagedResource. Follow a navigation from `apps/www/src/entry.client.ts` through `apps/www/src/update.ts` and `apps/www/src/command.ts`, then into `apps/www/src/entry.server.ts` for server data requests. Keep side effects out of `view` and stateful behavior in the owning submodel.

## UI primitives

Use the pinned `@foldkit/ui` 0.163.0 primitives for dialogs and popovers. Mobile navigation, search, playback, publish review, and account actions fold their primitive Models and Messages into the owning submodel. Keep the dialog mounted while closed so its Commands can manage native modal focus and scroll locking. Preserve native selects, sliders, and disclosures when they already provide the required behavior.

## Layout

`apps/www/src` follows Foldkit's [Project Organization](https://foldkit.dev/patterns/project-organization):

- Root modules (`init`, `model`, `message`, `update`, `view`, `route`, `command`, `subscription`) sit directly in `src/`.
- Each route owns a folder in `src/page/<name>/`. A stateful page splits into `model`, `message`, `command`, `init`, `update`, `subscription`, and `view`, adding a file only when the page has that concern. Its main view is exported as `view`.
- `page/<name>/index.ts` and `page/index.ts` are barrels only. The root `view.ts` calls pages through `import * as Page from './page'`.
- Root `model`, `message`, `update`, `init`, `command`, and `subscription` import a submodel's own folder (`./page/creator`), never the `./page` barrel. Pages import the root `Message`, so going through the barrel creates a circular import.
- Sub-screens of a page nest under `page/<name>/page/`, as in `page/dashboard/page/`.
- Server loaders live beside their page as `page-data.ts` and stay out of the barrel, so server code never reaches the client bundle. `server/page-data/` holds only dispatch and shared helpers.
- App-wide submodels that are not routes (`player`, `search`, `public-actions`) sit at the `src/` root. Shared view helpers live in `src/view/`.

## Diagnosing slow transitions

For a slow transition, separate browser navigation time, WWW request time, API spans, and client rendering. Local WWW and API traces go to Jaeger (`https://jaeger.localhost`); search `gbfm.request_id` and compare with the response `x-request-id`. Local request summaries are in Grafana's Loki datasource. A slow SSR trace alone does not prove the same delay in a client transition.

Foldkit also offers [agent skills](https://foldkit.dev/ai/skills) and a [DevTools MCP](https://foldkit.dev/ai/mcp) for Model and Message history. This repo has not yet vendored the pinned framework source or installed that MCP. Use the installed packages and version-matched docs now; add the subtree or runtime bridge only when the extra tooling earns its maintenance cost.
