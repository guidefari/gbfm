# D1 Migration Bundle Size

Measured on 2026-08-09 at commit `ok2b60dd4e` using Bun's browser build as the
workerd-compatible target. The entry point is `apps/vps/src/http/routes.ts`, the
current HTTP composition root. This includes its request-time services, Better
Auth, Drizzle, MDX, S3 client, and Sentry paths.

The build externalizes every Node builtin as required for `nodejs_compat`. Bun's
browser target rejects bare builtin specifiers, so both `node:*` and the bare
forms used by transitive dependencies are externalized. This is a size
measurement, not a claim that the current Bun-only runtime can run in a Worker:
the current graph still includes `@sentry/bun`, `pg`, and
`@effect/platform-bun`, all of which M4 must replace or remove.

## Result

| Build | Uncompressed bytes | Gzipped bytes | Gzipped MiB |
| --- | ---: | ---: | ---: |
| Current HTTP graph | 17,754,822 | 3,907,876 | 3.73 |
| Cloudflare paid-plan limit | - | 3,145,728 | 3.00 |
| Over limit | - | 762,148 | 0.73 |

**The current `apps/vps` HTTP dependency graph does not fit.** The current graph
is 24.2% over the 3 MiB gzipped limit.

That number measures the graph as it exists today, on Bun. It is not the gate.
See "Ported graph" below: the graph the migration actually ships **does** fit.

## Major Dependency Breakdown

The direct contribution is the difference between the complete gzipped bundle
and a second otherwise-identical bundle with the named dependency externalized.
It includes that dependency's transitively reachable code, and the numbers are
not additive because dependencies share code.

| Dependency externalized | Gzipped bundle without it | Gzipped contribution |
| --- | ---: | ---: |
| `effect`, `effect/*`, `@effect/*` | 2,720,670 | 1,187,206 |
| `@mdx-js/mdx` | 3,708,934 | 198,942 |
| `better-auth`, `better-auth/*` | 3,675,752 | 232,124 |
| `drizzle-orm`, `drizzle-orm/*` | 3,876,073 | 31,803 |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | 3,835,116 | 72,760 |
| `@sentry/bun`, `@sentry/*` | 3,650,433 | 257,443 |

`effect` plus the Effect platform packages is the largest measured contributor.
The current Sentry, Better Auth, and MDX paths are the next meaningful named
contributors. The remaining 2,720,670-byte no-Effect bundle also contains
runtime-specific packages that cannot ship unchanged, notably `pg`,
`@sentry/bun`, and `@effect/platform-bun`.

## Ported graph: the number that gates the migration

The measurement above includes packages the migration removes by design, so it
answers the wrong question. `@sentry/bun`, `@opentelemetry/*`, `pg`,
`@effect/platform-bun`, `@aws-sdk/*`, `pdf-lib`, `@pdf-lib/fontkit`, and
`qrcode` are all deleted or replaced in M3/M4: the QR/PDF feature is dropped, the
S3 client moves to R2 bindings, `pg` gives way to the D1 binding, platform-bun to
the Workers platform, and `@sentry/bun` to the Cloudflare Sentry SDK.

Externalizing exactly that set, on the same entry point and commit:

| Build | Gzipped bytes | Gzipped MiB | Against 3 MiB |
| --- | ---: | ---: | --- |
| Ported graph, MDX precompiled | 2,684,671 | 2.56 | **fits**, ~440 KiB headroom |
| Ported graph, MDX still in Worker | 2,883,436 | 2.75 | fits, ~256 KiB headroom |

**The bundle gate PASSES.** The migration as specified fits the Worker limit.

Two caveats for M4:

- The Cloudflare Sentry SDK is a replacement, not a deletion, and adds back an
  unmeasured amount. Re-measure once it is wired.
- MDX precompilation moves from required to recommended. Keeping MDX in the
  Worker leaves ~256 KiB of margin, which the Sentry SDK could consume. Precompile
  it if the margin tightens.

Reproduce with the base command plus:

```sh
--external='@sentry/bun' --external='@sentry/*' --external='@opentelemetry/*' \
--external=pg --external='@effect/platform-bun' \
--external='@aws-sdk/client-s3' --external='@aws-sdk/s3-request-presigner' \
--external=pdf-lib --external='@pdf-lib/fontkit' --external=qrcode \
--external='@mdx-js/mdx'
```

Drop the final `--external='@mdx-js/mdx'` for the MDX-retained figure.

## Reproduction

Run from `apps/vps`. These commands use the installed Bun and lockfile-resolved
dependency graph. The bare builtin list is explicit because these are the names
that the current graph imports without the `node:` prefix.

```sh
bun build ./src/http/routes.ts \
  --target=browser \
  --format=esm \
  --conditions=workerd \
  --external=perf_hooks \
  --external=worker_threads \
  --external=diagnostics_channel \
  --external=module \
  --external=tls \
  --external=dns \
  --external=async_hooks \
  --external='node:*' \
  --outfile='../../docs/migrations/evidence/.d1-http-app.js' \
  --metafile='../../docs/migrations/evidence/.d1-http-app-meta.json'

stat -f '%z bytes uncompressed' ../../docs/migrations/evidence/.d1-http-app.js
gzip -9c ../../docs/migrations/evidence/.d1-http-app.js | wc -c
```

The base command produced `17,754,822` uncompressed bytes and `3,907,876`
gzipped bytes. Re-run that command with the following additional external flags
to reproduce each differential measurement, then gzip the resulting file as
above:

```sh
--external=effect --external='effect/*' --external='@effect/*'
--external='@mdx-js/mdx'
--external=better-auth --external='better-auth/*'
--external=drizzle-orm --external='drizzle-orm/*'
--external='@aws-sdk/client-s3' --external='@aws-sdk/s3-request-presigner'
--external='@sentry/bun' --external='@sentry/*'
```

For each variant, subtract its gzipped byte count from `3,907,876`. Delete the
temporary `.d1-*.js` and `.d1-*-meta.json` files after recording the result;
they are intentionally not versioned.
