# [1.3.0](https://github.com/guidefari/gbfm/compare/v1.2.0...v1.3.0) (2025-12-27)


### Features

* better auth migration ([0ad61fc](https://github.com/guidefari/gbfm/commit/0ad61fc595dc80b66f9234997d7a445072d4bef0))

# [1.2.0](https://github.com/guidefari/gbfm/compare/v1.1.2...v1.2.0) (2025-12-14)


### Bug Fixes

* remove any ([0e49ef0](https://github.com/guidefari/gbfm/commit/0e49ef03da9b407a7519a50e5f5c9881df8c77e4))


### Features

* audio player wip ([e1c8bab](https://github.com/guidefari/gbfm/commit/e1c8bab50d3b0ca0b7c986fe6b49ed5966b60a20))
* remove shuffle and repeat ([69be785](https://github.com/guidefari/gbfm/commit/69be7851a3e99cf24f170ca6cd3cd958ae12960e))
* render markdown ([c24b019](https://github.com/guidefari/gbfm/commit/c24b01942104aca80db8427b289b0d262c42243a))
* seed rbac ([e2f4a99](https://github.com/guidefari/gbfm/commit/e2f4a99d62f2734520215f21c8d464ef390fac4a))

## [1.1.2](https://github.com/guidefari/gbfm/compare/v1.1.1...v1.1.2) (2025-12-06)


### Bug Fixes

* layer merging ([a1c2f52](https://github.com/guidefari/gbfm/commit/a1c2f52238f9b735ff64c48a2aa61364044795ad))
* queue on full screen audio player ([12e26c8](https://github.com/guidefari/gbfm/commit/12e26c806f236ba4a8dcf2ad457ae34f30b11cb2))

## [1.1.1](https://github.com/guidefari/gbfm/compare/v1.1.0...v1.1.1) (2025-11-23)


### Bug Fixes

* share url ([764ee25](https://github.com/guidefari/gbfm/commit/764ee25bf6ce4be4dcc75a4562d2289231ddcefd))

# [1.1.0](https://github.com/guidefari/gbfm/compare/v1.0.0...v1.1.0) (2025-11-23)


### Features

* Add Open Graph meta tags for link sharing ([#70](https://github.com/guidefari/gbfm/issues/70)) ([9161d49](https://github.com/guidefari/gbfm/commit/9161d490cb1d9329538978b81cee51ccc217d23f))

# [1.0.0](https://github.com/guidefari/gbfm/compare/v0.36.1...v1.0.0) (2025-11-23)


* Add default pagination to VPS GET endpoints ([#68](https://github.com/guidefari/gbfm/issues/68)) ([77fa9d6](https://github.com/guidefari/gbfm/commit/77fa9d6b0caf963465a2ef00d81963a5621e7fde))


### BREAKING CHANGES

* Response format changed from arrays to paginated objects

* chore: Remove migration 0008 for regeneration

Removed migration 0008_next_echo.sql to regenerate it cleanly.
This ensures the migration is properly generated from the current schema state after rebasing with prod.

* fix: Handle count query result properly and fix TypeScript errors

- Fix count() result destructuring - handle potentially undefined first element
- Remove unused 'desc' import from publication handlers (orders by name not createdAt)
- Remove unused 'and' import from label handlers
- All pagination queries now properly handle count results with nullish coalescing
- Publications table orders by name instead of non-existent createdAt field
- Pass typecheck and biome checks

* feat: Update UI clients to support pagination

- Updated www app API client (http.ts) to use useInfiniteQuery for paginated endpoints
- Added pagination controls to mixes, tracks, and labels list pages
- Added "Load More" functionality to label detail page releases
- Updated Raycast extension to automatically load all pages on mount
- All clients now support the new paginated API response format

Changes:
- apps/www/src/lib/http.ts: Converted useAudioByType, useAllLabels, useReleasesByLabel to useInfiniteQuery
- apps/www/src/routes/mixes/index.tsx: Added "Load More" button
- apps/www/src/routes/labels/index.tsx: Added "Load More Labels" button
- apps/www/src/routes/tracks/index.tsx: Added conditional "Load More" buttons for each audio type
- apps/www/src/routes/labels/$labelSlug.tsx: Added "Load More Releases" button
- apps/raycast/src/list-content.tsx: Auto-load all pages of mixes
- apps/raycast/src/edit-mix.tsx: Auto-load all pages of mixes in dropdown
- apps/raycast/src/edit-label.tsx: Auto-load all pages of labels in dropdown

* wip

* format

## [0.36.1](https://github.com/guidefari/gbfm/compare/v0.36.0...v0.36.1) (2025-11-23)


### Bug Fixes

* posthog configs ([25e082b](https://github.com/guidefari/gbfm/commit/25e082b4597d9748c363b4aef635b24bcd1192fa))

# [0.36.0](https://github.com/guidefari/gbfm/compare/v0.35.0...v0.36.0) (2025-11-23)


### Features

* posthog ([7a1e609](https://github.com/guidefari/gbfm/commit/7a1e6090158f8c019afbacf61465550e43281db2))

# [0.35.0](https://github.com/guidefari/gbfm/compare/v0.34.0...v0.35.0) (2025-11-23)


### Features

* Create database backup scripts ([#64](https://github.com/guidefari/gbfm/issues/64)) ([467afaa](https://github.com/guidefari/gbfm/commit/467afaa39904a04cf9e7821a4af9458e1ff5f315))

# [0.34.0](https://github.com/guidefari/gbfm/compare/v0.33.0...v0.34.0) (2025-11-03)


### Features

* send mix notification ([ab55950](https://github.com/guidefari/gbfm/commit/ab55950f4a628f23f9e1a03678c3d36e784cbb3a))

# [0.33.0](https://github.com/guidefari/gbfm/compare/v0.32.0...v0.33.0) (2025-10-26)


### Features

* mix page metadata ([0e2dfea](https://github.com/guidefari/gbfm/commit/0e2dfeaf953b0129a108c312317fec1bb5139259))

# [0.32.0](https://github.com/guidefari/gbfm/compare/v0.31.0...v0.32.0) (2025-10-26)


### Features

* application level query timer ([7349957](https://github.com/guidefari/gbfm/commit/7349957273174e121fa938ea60a5b1ec6650f7af))
* new mix notification email ([6c69212](https://github.com/guidefari/gbfm/commit/6c69212b2ad7e5f2557c68c0ac3d429560b676ea))

# [0.31.0](https://github.com/guidefari/gbfm/compare/v0.30.1...v0.31.0) (2025-10-26)


### Bug Fixes

* ci cache hash file ([6a2f2bb](https://github.com/guidefari/gbfm/commit/6a2f2bb8ae7996fdfc230b0bf6c8e358f65ad5b5))
* date types ([9e44dae](https://github.com/guidefari/gbfm/commit/9e44daeba51249243c54c709cc4e927168abe8c8))
* ts ([32b0ae3](https://github.com/guidefari/gbfm/commit/32b0ae353749052ebd9bf2e64d5a6fbb083c01b0))
* ts ([1a6ae1e](https://github.com/guidefari/gbfm/commit/1a6ae1ed8f4079a6ef9e7eea74f598b274bb33b5))
* ts ([49ca97b](https://github.com/guidefari/gbfm/commit/49ca97bef57dee98f354a5d62a35b0899a43b726))
* ts. ffs. ([ba9239f](https://github.com/guidefari/gbfm/commit/ba9239f82f63e36238696949878cfdc3cacfe878))
* validate limit values for spotify pagination ([0f522e7](https://github.com/guidefari/gbfm/commit/0f522e7dc4bdccf1c64c1de902a2cfb6074c964f))
* **vps:** zod skill issue ([50ed57e](https://github.com/guidefari/gbfm/commit/50ed57ec6a76e188667eaf8c0576e6198b52fecf))


### Features

* fetch client (to be replaced by something that's automated pls) ([98bc9eb](https://github.com/guidefari/gbfm/commit/98bc9eb7fd17c7572b848240b2e09987fcff3848))
* labels admin cms ([d0ce2b8](https://github.com/guidefari/gbfm/commit/d0ce2b860e9b1b8ba5f8bc38b5c1a56dca2843e0))
* quick share ([d06d62b](https://github.com/guidefari/gbfm/commit/d06d62b3040db2a63b243f144ea10088f0ad313d))
* release ([d5fd319](https://github.com/guidefari/gbfm/commit/d5fd319a44a9eeab08926cc8b478e699e835c080))
* wip react-native fps meter ([d9a2be5](https://github.com/guidefari/gbfm/commit/d9a2be543d3944cfc17d2f1c689972b14dbd0b0c))

## [0.30.1](https://github.com/guidefari/gbfm/compare/v0.30.0...v0.30.1) (2025-10-09)


### Bug Fixes

* add links to spotify components ([cf3ef23](https://github.com/guidefari/gbfm/commit/cf3ef2338719f12de83611bc101b02bce8956a07))

# [0.30.0](https://github.com/guidefari/gbfm/compare/v0.29.0...v0.30.0) (2025-10-09)


### Bug Fixes

* bring back spotify ([fca9856](https://github.com/guidefari/gbfm/commit/fca9856efe951b29474b9e5918c96941f01192f3))
* build ([4e45eba](https://github.com/guidefari/gbfm/commit/4e45eba9dee4d68cf84e815bf2612b5bd77df969))


### Features

* labels. lowkey (highkey) wip tho. ([391ab61](https://github.com/guidefari/gbfm/commit/391ab61e216c06c9f327210843ac49c331a2b94b))
* raycast wip ([4ad7007](https://github.com/guidefari/gbfm/commit/4ad7007a7089d1e9a887db759283b8c9edb63188))

# [0.29.0](https://github.com/guidefari/gbfm/compare/v0.28.4...v0.29.0) (2025-10-07)


### Features

* theming updates ([4ff6944](https://github.com/guidefari/gbfm/commit/4ff6944153f98cf8a64665c028fa4e2bb9f7a4d5))

## [0.28.4](https://github.com/guidefari/gbfm/compare/v0.28.3...v0.28.4) (2025-10-06)


### Bug Fixes

* dockerfile ([96b8a37](https://github.com/guidefari/gbfm/commit/96b8a3762a47e001a7ab79197c5614b6e5ada576))

## [0.28.3](https://github.com/guidefari/gbfm/compare/v0.28.2...v0.28.3) (2025-10-06)


### Bug Fixes

* remove redundant typecheck ([55e081c](https://github.com/guidefari/gbfm/commit/55e081c05eb1239a3cc86ee070383c604c046f33))

## [0.28.2](https://github.com/guidefari/gbfm/compare/v0.28.1...v0.28.2) (2025-10-06)


### Bug Fixes

* dockerfile ([c084277](https://github.com/guidefari/gbfm/commit/c084277b96d9d2eddbb2e136ada4df15023bcebf))

## [0.28.1](https://github.com/guidefari/gbfm/compare/v0.28.0...v0.28.1) (2025-10-06)


### Bug Fixes

* dockerfile ([40f77be](https://github.com/guidefari/gbfm/commit/40f77be5f26d2fb05b0f27ab5f73a067cdf6fd63))

# [0.28.0](https://github.com/guidefari/gbfm/compare/v0.27.1...v0.28.0) (2025-10-06)


### Bug Fixes

* web build script ([fd6a502](https://github.com/guidefari/gbfm/commit/fd6a502662614b0a823a87bceb71f42ef3f6e459))


### Features

* fe types ([2fb9d01](https://github.com/guidefari/gbfm/commit/2fb9d011c7bd7c81fefb93056e90db094adddc52))

## [0.27.1](https://github.com/guidefari/gbfm/compare/v0.27.0...v0.27.1) (2025-10-06)


### Bug Fixes

* vps type fixes ([23cae93](https://github.com/guidefari/gbfm/commit/23cae932408eab4a138aefc4fa65a003bf49bfe3))

# [0.27.0](https://github.com/guidefari/gbfm/compare/v0.26.0...v0.27.0) (2025-09-28)


### Features

* cms wip ([df8a83e](https://github.com/guidefari/gbfm/commit/df8a83e29d19761ca353a5e411dec65cb9d8743d))

# [0.26.0](https://github.com/guidefari/gbfm/compare/v0.25.1...v0.26.0) (2025-09-24)


### Features

* content endpoints ([4731b9c](https://github.com/guidefari/gbfm/commit/4731b9cd72928ba2b2935cf70da8e34fe77a50f2))

## [0.25.1](https://github.com/guidefari/gbfm/compare/v0.25.0...v0.25.1) (2025-09-14)


### Bug Fixes

* missing secret ([79e047a](https://github.com/guidefari/gbfm/commit/79e047aae66ceb7104068455b409a0158e747f24))

# [0.25.0](https://github.com/guidefari/gbfm/compare/v0.24.0...v0.25.0) (2025-09-14)


### Features

* db migration ([2172a12](https://github.com/guidefari/gbfm/commit/2172a12867fd97962915399eebc9ad666b1dc5f7))
* db migration cont ([7663fdc](https://github.com/guidefari/gbfm/commit/7663fdcbb7979f1e20384bbad1ea65332f05be10))

# [0.24.0](https://github.com/guidefari/gbfm/compare/v0.23.0...v0.24.0) (2025-08-09)


### Features

* audio player + keyboard shortcuts ([5abc7bc](https://github.com/guidefari/gbfm/commit/5abc7bc40accfd25303f2587ebcc5837cf4cf1c1))

# [0.23.0](https://github.com/guidefari/gbfm/compare/v0.22.0...v0.23.0) (2025-08-08)


### Features

* fullscreen audio player ([d8a1fd0](https://github.com/guidefari/gbfm/commit/d8a1fd07a63de1de8e9795dce2adc428f6100363))

# [0.22.0](https://github.com/guidefari/gbfm/compare/v0.21.0...v0.22.0) (2025-08-07)


### Features

* queue ([314b2e6](https://github.com/guidefari/gbfm/commit/314b2e6db9ba4bf7e70d3cd58fa2d5951ba352ec))
* refreshed audio player ([38acf73](https://github.com/guidefari/gbfm/commit/38acf7319a85bea45946ccf3f5622c081dc4eb85))

# [0.21.0](https://github.com/guidefari/gbfm/compare/v0.20.2...v0.21.0) (2025-08-06)


### Features

* upload audio ([8066e35](https://github.com/guidefari/gbfm/commit/8066e35f9f8db0d37debf78e17081b58ab399883))

## [0.20.2](https://github.com/guidefari/gbfm/compare/v0.20.1...v0.20.2) (2025-08-05)


### Bug Fixes

* web build script ([f43c60a](https://github.com/guidefari/gbfm/commit/f43c60a2088f30f543ec6a721c959f5e8abb9643))

## [0.20.1](https://github.com/guidefari/gbfm/compare/v0.20.0...v0.20.1) (2025-08-05)


### Bug Fixes

* deploy script ([4e11b32](https://github.com/guidefari/gbfm/commit/4e11b32d7108aabb898a8c95207336e5aaa9f7a3))

# [0.20.0](https://github.com/guidefari/gbfm/compare/v0.19.1...v0.20.0) (2025-08-05)


### Features

* volume controls ([da32fc0](https://github.com/guidefari/gbfm/commit/da32fc08f5021290f7ab805b89b61f217abf8114))

## [0.19.1](https://github.com/guidefari/gbfm/compare/v0.19.0...v0.19.1) (2025-08-05)


### Bug Fixes

* docker entrypoint ([56d3f2b](https://github.com/guidefari/gbfm/commit/56d3f2ba12c9fe39dd07af1183f1eeaf3e52f2dd))

# [0.19.0](https://github.com/guidefari/gbfm/compare/v0.18.0...v0.19.0) (2025-08-05)


### Bug Fixes

* dockerfile ([2a06d02](https://github.com/guidefari/gbfm/commit/2a06d02842177c9bd6146b1ca4f9f6ce2ff91732))


### Features

* loading skeleton ([b7c548f](https://github.com/guidefari/gbfm/commit/b7c548fa78e61faceba4718e2d723e7d24aaa964))

# [0.18.0](https://github.com/guidefari/gbfm/compare/v0.17.0...v0.18.0) (2025-08-05)


### Features

* audio player improvements ([5577abe](https://github.com/guidefari/gbfm/commit/5577abed16e359f3ebe5e23e50b49cfb731dff8e))

# [0.17.0](https://github.com/guidefari/gbfm/compare/v0.16.0...v0.17.0) (2025-08-03)


### Bug Fixes

* grid on single mix page was wonky ([aeb46e8](https://github.com/guidefari/gbfm/commit/aeb46e847ed298a0fda603f4ff4127d1c2e75ae5))
* remove redundant frontmatter processing ([103b086](https://github.com/guidefari/gbfm/commit/103b0868629a4ec4586fe04e8851f4e2fbff62b7))


### Features

* single mix page ([0d23491](https://github.com/guidefari/gbfm/commit/0d23491731de4a9a25202a807681391d801cb47e))

# [0.16.0](https://github.com/guidefari/gbfm/compare/v0.15.0...v0.16.0) (2025-08-01)


### Features

* commando updates ([0841bd3](https://github.com/guidefari/gbfm/commit/0841bd31e5ae6e6d22412afa4a50ecb992f6ddef))

# [0.15.0](https://github.com/guidefari/gbfm/compare/v0.14.0...v0.15.0) (2025-07-27)


### Features

* dynamic rss ([de26bb6](https://github.com/guidefari/gbfm/commit/de26bb66f19859326992058d2828a997a3804cfc))
* file upload endpoints ([fcc59a6](https://github.com/guidefari/gbfm/commit/fcc59a69921e903c019565ac10a489d825ccbb50))
* upload audio ui ([485cb92](https://github.com/guidefari/gbfm/commit/485cb9240535fbb412d8be9c9f2d524927750c1e))

# [0.14.0](https://github.com/guidefari/gbfm/compare/v0.13.0...v0.14.0) (2025-07-26)


### Features

* remove web workers. ([5689fed](https://github.com/guidefari/gbfm/commit/5689fed7bc25cdd86957ae660aa4c506a8256265))

# [0.13.0](https://github.com/guidefari/gbfm/compare/v0.12.0...v0.13.0) (2025-07-26)


### Features

* update profile ([fad00e6](https://github.com/guidefari/gbfm/commit/fad00e6ccc516793c758d27074edc91540de7f45))

# [0.12.0](https://github.com/guidefari/gbfm/compare/v0.11.0...v0.12.0) (2025-07-26)


### Bug Fixes

* type errors ([88bcac9](https://github.com/guidefari/gbfm/commit/88bcac941e01fb3c2495123a652fe4b2fd9bde8f))


### Features

* auth & profile stuff ([e7e1490](https://github.com/guidefari/gbfm/commit/e7e1490009b66bf7f7d6442229fc61a8eba364d2))

# [0.11.0](https://github.com/guidefari/gbfm/compare/v0.10.4...v0.11.0) (2025-07-26)


### Features

* update mix route ([9acbbc0](https://github.com/guidefari/gbfm/commit/9acbbc0a0562ada6d0147025c18e51d05d6ca677))

## [0.10.4](https://github.com/guidefari/gbfm/compare/v0.10.3...v0.10.4) (2025-07-25)


### Bug Fixes

* add pnpm workspace file to container ([92e5034](https://github.com/guidefari/gbfm/commit/92e503459881f160b2a7b61c67b1a092ab7b45c0))

## [0.10.3](https://github.com/guidefari/gbfm/compare/v0.10.2...v0.10.3) (2025-07-25)


### Bug Fixes

* www build script ([12e2b41](https://github.com/guidefari/gbfm/commit/12e2b41b94417063fdc1957e9b166ecc03acad67))

## [0.10.2](https://github.com/guidefari/gbfm/compare/v0.10.1...v0.10.2) (2025-07-25)


### Bug Fixes

* www build script ([1585e92](https://github.com/guidefari/gbfm/commit/1585e92d07ff427fc48b1a4f3855c3933706f88b))

## [0.10.1](https://github.com/guidefari/gbfm/compare/v0.10.0...v0.10.1) (2025-07-25)


### Bug Fixes

* dockerfile paths ([ac2ce8e](https://github.com/guidefari/gbfm/commit/ac2ce8e608269db90fda3b114b69ae343946a68e))

# [0.10.0](https://github.com/guidefari/gbfm/compare/v0.9.0...v0.10.0) (2025-07-25)


### Features

* content migration scripts ([b5881b2](https://github.com/guidefari/gbfm/commit/b5881b2c6c21f592c6e77c0286567c8df12980f4))

# [0.9.0](https://github.com/guidefari/gbfm/compare/v0.8.0...v0.9.0) (2025-07-25)


### Features

* migrating from mixes schema to generic audio ([c5335f0](https://github.com/guidefari/gbfm/commit/c5335f04fd78b6eddb094851f29bc926a4dfa217))

# [0.8.0](https://github.com/guidefari/gbfm/compare/v0.7.0...v0.8.0) (2025-07-23)


### Features

* release test ([d3fb620](https://github.com/guidefari/gbfm/commit/d3fb6209591b1737cfa2d29278cd551b038b5cee))

# [0.7.0](https://github.com/guidefari/gbfm/compare/v0.6.5...v0.7.0) (2025-07-23)


### Bug Fixes

* update seed scripts ([bfe3835](https://github.com/guidefari/gbfm/commit/bfe38358176fd97b590d966ceec0fc1fa4bce4b8))


### Features

* disable seed endpoint ([5bc992e](https://github.com/guidefari/gbfm/commit/5bc992efb30cd133ab098fb789012c0421f59984))

## [0.6.5](https://github.com/guidefari/gbfm/compare/v0.6.4...v0.6.5) (2025-07-22)


### Bug Fixes

* import path ([0b1b641](https://github.com/guidefari/gbfm/commit/0b1b6413969ea32cefeaa4be901eb6a0d717d485))
* type errors - #blind fix👀 ([0248c02](https://github.com/guidefari/gbfm/commit/0248c02e7a782247b88d15191af1407a659ddcbd))
