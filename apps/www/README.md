# `@gbfm/www`

## Changelog page

`src/routes/changelog.tsx` renders the repo root `CHANGELOG.md` as the public changelog page.

The repo intentionally uses `CHANGELOG.md` as the only source of truth.

We do not keep a second tracked copy under `apps/www/src/` anymore because that drifted after releases:

- `semantic-release` updates the root `CHANGELOG.md`
- the old `sync-changelog.ts` script copied it into the app
- local `dev` or `build` runs would then create seemingly random diffs when the copied file lagged behind

## Why there is a Vite plugin

Yes: `plugins/repo-changelog.ts` is a small manually written Vite plugin.

It exists because the app needs the root `CHANGELOG.md` content at build/dev time, but importing `.md` directly from the app goes through the MDX pipeline. For the changelog route we want the raw file contents first, then we compile that content intentionally inside the route loader.

The plugin provides a virtual module called `virtual:repo-changelog` that:

- reads `../../CHANGELOG.md` from the repo root
- returns the file contents as a string export
- watches that file during dev so edits trigger reloads

Then `src/routes/changelog.tsx`:

- imports `virtual:repo-changelog`
- compiles the string with `@mdx-js/mdx`
- renders it with `MDXRendrr`

## Files involved

- `CHANGELOG.md`
- `apps/www/plugins/repo-changelog.ts`
- `apps/www/src/routes/changelog.tsx`
- `apps/www/src/virtual-modules.d.ts`

## References

- Vite plugin API: `https://vite.dev/guide/api-plugin.html`
- Vite virtual modules convention: `https://vite.dev/guide/api-plugin.html#virtual-modules-convention`
- MDX package docs: `https://mdxjs.com/packages/mdx/`
