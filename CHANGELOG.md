# [2.20.0](https://github.com/guidefari/gbfm/compare/v2.19.0...v2.20.0) (2026-02-15)


### Features

* create/update post ([84cc06e](https://github.com/guidefari/gbfm/commit/84cc06e6d0b9086cdf50415eca774689c48383aa))

# [2.19.0](https://github.com/guidefari/gbfm/compare/v2.18.0...v2.19.0) (2026-02-13)


### Bug Fixes

* run precommit ([48cd614](https://github.com/guidefari/gbfm/commit/48cd614ff493778051d47a4bc2f5ec0d065f3cbe))
* **www:** extract MixListItem component and fix mobile overflow ([227e3f4](https://github.com/guidefari/gbfm/commit/227e3f479f5dc3dacffd0ef12021b2960692bc6d))


### Features

* analytics wrapper ([0fe55b8](https://github.com/guidefari/gbfm/commit/0fe55b88ed36ca49dd89402d28fe7ae949c622d7))
* local feature flag ([8b91a16](https://github.com/guidefari/gbfm/commit/8b91a16973921f3bf7574136c5bd38c33e2d33c8))
* **www:** use effect (👀) ([fdef587](https://github.com/guidefari/gbfm/commit/fdef58783bc8e02777a3795a8807326132c001c4))

# [2.18.0](https://github.com/guidefari/gbfm/compare/v2.17.0...v2.18.0) (2026-02-13)


### Bug Fixes

* marquee ([14769c5](https://github.com/guidefari/gbfm/commit/14769c5573be064a9c7db27d3a060e5b79162819))


### Features

* audio player improvements ([b98c9c7](https://github.com/guidefari/gbfm/commit/b98c9c71934c48373cfb04fe392bf06a09887e71))

# [2.17.0](https://github.com/guidefari/gbfm/compare/v2.16.0...v2.17.0) (2026-02-13)


### Bug Fixes

* build ([ba2757a](https://github.com/guidefari/gbfm/commit/ba2757ab31c46269dfb0d41b1f3e612ebcaebfab))


### Features

* **vps:** add post by slug endpoint with MDX compilation ([38c8d56](https://github.com/guidefari/gbfm/commit/38c8d56a47c7db725397850fb8a95644c35dc908))
* **vps:** add post share/redirect handler ([0e4750b](https://github.com/guidefari/gbfm/commit/0e4750b7af88e63db10e8913fda992ed5aaace32))
* **www:** add dispatch and pings post routes with show page improvements ([46b1e55](https://github.com/guidefari/gbfm/commit/46b1e55336df6616f402ef6f5bcab8ac9db8e312))

# [2.16.0](https://github.com/guidefari/gbfm/compare/v2.15.0...v2.16.0) (2026-02-10)


### Features

* posts endpoint ([2b22631](https://github.com/guidefari/gbfm/commit/2b226317a1415f1911ed8dec66405d72cdeca7df))

# [2.15.0](https://github.com/guidefari/gbfm/compare/v2.14.0...v2.15.0) (2026-02-10)


### Features

* favourites and subscribing ([67dcde5](https://github.com/guidefari/gbfm/commit/67dcde5aa05cd7489bbc3ed09d1878d96ae2218e))
* favourites/subscribe triggers modal sign up/login ([ff67687](https://github.com/guidefari/gbfm/commit/ff676870a80b980db57b89da6e499db7c8bae1c6))
* onboarding improvements ([ef1de3f](https://github.com/guidefari/gbfm/commit/ef1de3fcc8d2ed17db9d725197160de83c809d05))

# [2.14.0](https://github.com/guidefari/gbfm/compare/v2.13.3...v2.14.0) (2026-02-04)


### Features

* audio player and profile improvements ([e3c36dd](https://github.com/guidefari/gbfm/commit/e3c36ddb52cc895919e40b4b91405ed630546a96))

## [2.13.3](https://github.com/guidefari/gbfm/compare/v2.13.2...v2.13.3) (2026-02-04)


### Bug Fixes

* clickable username on audio player ([e021dc5](https://github.com/guidefari/gbfm/commit/e021dc55dcab51620644fb958fa0e7d09da86ba3))

## [2.13.2](https://github.com/guidefari/gbfm/compare/v2.13.1...v2.13.2) (2026-02-04)


### Bug Fixes

* remove display_username ([7b9aa9b](https://github.com/guidefari/gbfm/commit/7b9aa9b3f9450b65abf24d62b5382eabaa483d04))

## [2.13.1](https://github.com/guidefari/gbfm/compare/v2.13.0...v2.13.1) (2026-02-03)


### Bug Fixes

* force version bump 😛 ([159e33e](https://github.com/guidefari/gbfm/commit/159e33e68bb7d6b2cf0f90135ae66b0e72a1e0c9))

# [2.13.0](https://github.com/guidefari/gbfm/compare/v2.12.0...v2.13.0) (2026-02-03)


### Bug Fixes

* **www:** address critical production issues ([00a9fda](https://github.com/guidefari/gbfm/commit/00a9fda00b73b354cc4330438b79c98e977e7565))


### Features

* **vps:** add rate limiting to public endpoints ([3b428f0](https://github.com/guidefari/gbfm/commit/3b428f0409d4233d379a52a685ba72470285d8b2))

# [2.12.0](https://github.com/guidefari/gbfm/compare/v2.11.0...v2.12.0) (2026-01-30)


### Features

* add `show` support to favourites ([a658638](https://github.com/guidefari/gbfm/commit/a6586386b75b6c9077fea6756c2bc5bb18aff310))
* Implement a cron job to clean up expired QR PDF files from S3 using a new S3 object listing capability. ([4847842](https://github.com/guidefari/gbfm/commit/4847842bb4232cd234275af010ddff0212e0ebf3))
* qr service ([75b6394](https://github.com/guidefari/gbfm/commit/75b639449011f3c876db05e2815d5f8420b7c5ab))
* restrict QR download functionality to admin and creator roles. ([c84d587](https://github.com/guidefari/gbfm/commit/c84d587f8dcc428c5a0d3d8d1dbf82888c926071))

# [2.11.0](https://github.com/guidefari/gbfm/compare/v2.10.0...v2.11.0) (2026-01-29)


### Features

* mix upload ([db49d8f](https://github.com/guidefari/gbfm/commit/db49d8f12e130f7372de49386170f2048a23025f))

# [2.10.0](https://github.com/guidefari/gbfm/compare/v2.9.0...v2.10.0) (2026-01-28)


### Features

* Enhance admin user editing to include username, display name, profile image, email verification, and real-time username availability checks. ([fd308bd](https://github.com/guidefari/gbfm/commit/fd308bd206ac5322c6f5c89c947cbd32f51d7bcd))

# [2.9.0](https://github.com/guidefari/gbfm/compare/v2.8.0...v2.9.0) (2026-01-28)


### Features

* add user search functionality for admin and implement reserved slug generation and validation ([86676b4](https://github.com/guidefari/gbfm/commit/86676b47771061f716317010ea1d0050e861dff9))
* Implement banner image support for shows and enhance host linking with user profiles. ([33edb38](https://github.com/guidefari/gbfm/commit/33edb38fe4b30f71d782a788faa881c5c80bf058))
* Implement newsletter subscription functionality and add an admin tab for show management. ([834ed96](https://github.com/guidefari/gbfm/commit/834ed96bcded36426254cfc44bf87a8a03a76f43))
* implement slug resolution to user profiles or shows and enhance authentication context attachment. ([196161f](https://github.com/guidefari/gbfm/commit/196161fc9f8995bb8e9ccca622f404923da7e83d))
* Redesign show page to include a new banner, detailed header, and structured content sections. ([d13262d](https://github.com/guidefari/gbfm/commit/d13262dc0c9a600d0fc37f3d679466a5f15a5b53))

# [2.8.0](https://github.com/guidefari/gbfm/compare/v2.7.3...v2.8.0) (2026-01-28)


### Features

* Add 'Radio Shows' navigation, enhance mix details with queueing and creator links, and introduce show skeleton loading. ([eba130d](https://github.com/guidefari/gbfm/commit/eba130dc863cf7e0d5c22d7b28c295719deb75b2))

## [2.7.3](https://github.com/guidefari/gbfm/compare/v2.7.2...v2.7.3) (2026-01-28)


### Bug Fixes

* play mix button ([da3c9a3](https://github.com/guidefari/gbfm/commit/da3c9a3a2bea2a51c481cc5be4efc7c6a9468425))

## [2.7.2](https://github.com/guidefari/gbfm/compare/v2.7.1...v2.7.2) (2026-01-28)


### Bug Fixes

* revert to absolute positioning for music player ([cbbc976](https://github.com/guidefari/gbfm/commit/cbbc9769b60f8021af653e3a64edc2866c179099))

## [2.7.1](https://github.com/guidefari/gbfm/compare/v2.7.0...v2.7.1) (2026-01-28)


### Bug Fixes

* formatting ([b9451e1](https://github.com/guidefari/gbfm/commit/b9451e183334f3acaf77fcd225306657fe05965b))
* mobile responsive mixes page ([d1ae448](https://github.com/guidefari/gbfm/commit/d1ae448c4191e92aab8b5dd5fafb21ff775df32f))

# [2.7.0](https://github.com/guidefari/gbfm/compare/v2.6.0...v2.7.0) (2026-01-27)


### Features

* update audio creatorId ([d7eef10](https://github.com/guidefari/gbfm/commit/d7eef1057198757a4716facd0eeb7b5dcf301f4a))

# [2.6.0](https://github.com/guidefari/gbfm/compare/v2.5.0...v2.6.0) (2026-01-27)


### Features

* Implement user display names and admin user creation/management. ([3ff6b33](https://github.com/guidefari/gbfm/commit/3ff6b3328fc7e79cac402687f8977ee95bb46385))

# [2.5.0](https://github.com/guidefari/gbfm/compare/v2.4.0...v2.5.0) (2026-01-27)


### Features

* observability improvements ([3723b98](https://github.com/guidefari/gbfm/commit/3723b98bb6a8a953e91125fb9667069b51600fb4))

# [2.4.0](https://github.com/guidefari/gbfm/compare/v2.3.0...v2.4.0) (2026-01-27)


### Bug Fixes

* effect devtools packages ([59e317e](https://github.com/guidefari/gbfm/commit/59e317e5e0efaee4ae3e066703e21376fb61d17f))
* effect lsp errors ([8375ab2](https://github.com/guidefari/gbfm/commit/8375ab20f298dfdf8e0b847203801c3c0d85a08f))
* effect type errors ([593c21f](https://github.com/guidefari/gbfm/commit/593c21f9debd2dc0669d8e281216988b415749b0))
* export shows schema ([e720e4a](https://github.com/guidefari/gbfm/commit/e720e4aaede3ae07d29e17bae006e90d9fc9fc1b))
* formatting ([6dfabcf](https://github.com/guidefari/gbfm/commit/6dfabcf3af9c3ef8e42903da642e3d1d6bad8f3f))
* more errors highlighted by effect lsp ([01b7536](https://github.com/guidefari/gbfm/commit/01b7536de89ae39ae07fdb800cd530b25ff5b1e0))


### Features

* dev tools ([dfceb5d](https://github.com/guidefari/gbfm/commit/dfceb5d04457cbdebb7a2ac9f79516c49634ed47))
* effect devtools ([189c9b2](https://github.com/guidefari/gbfm/commit/189c9b2a08ada7545426aca9da9e7afc2f247d67))
* landing page ([a08c37d](https://github.com/guidefari/gbfm/commit/a08c37de7f34d22aa87c1a59e64d03f47222870b))
* memory gauge ([db32940](https://github.com/guidefari/gbfm/commit/db32940d7991d15e275853e7e40611ba78cffbec))
* shows backend ([0436146](https://github.com/guidefari/gbfm/commit/0436146c041ba41e8cd284f9472f5a12006a9fd6))
* spans ([3525b47](https://github.com/guidefari/gbfm/commit/3525b470c1785615258a2c5a9ee62a01a2736e23))
* username and public profile ([dca8d78](https://github.com/guidefari/gbfm/commit/dca8d78c2104611db64177fa0676f6d6b19e6842))
* **wip:** Implement show listing, detail pages, and user subscription management for shows. ([132fabf](https://github.com/guidefari/gbfm/commit/132fabf973b96811baadc3f853725acd691b78a9))

# [2.3.0](https://github.com/guidefari/gbfm/compare/v2.2.1...v2.3.0) (2026-01-24)


### Features

* **backup:** extract LogCapture to shared utilities with idiomatic Effect ([e7507dc](https://github.com/guidefari/gbfm/commit/e7507dc0eff43bffd46351a6fafc164a0272f07c))
* preload track ([95a6d22](https://github.com/guidefari/gbfm/commit/95a6d22d24099fdc754a263ddfd43469036bbbb6))
* remiinders styling ([207ed8d](https://github.com/guidefari/gbfm/commit/207ed8d5f161afd8356428b6fb0ed9b992697962))
* **seo:** add SEO to index pages and create sitemap/robots.txt ([c71ca4c](https://github.com/guidefari/gbfm/commit/c71ca4c39895fc410d204d2b6d1542902a1ac144))
* **seo:** add SEO utilities and metadata to dynamic routes ([ea906c4](https://github.com/guidefari/gbfm/commit/ea906c468271833ee6d3edf010132dc86d74b249))
* settngs and dashboard ([eb7e817](https://github.com/guidefari/gbfm/commit/eb7e8170768823e3e8c9250b046a44e78be4a0f0))
* update mixes layout ([4063e27](https://github.com/guidefari/gbfm/commit/4063e276441247f7b2dc8d6790acc149105d5578))
* updateTagsMutation ([3ef1277](https://github.com/guidefari/gbfm/commit/3ef1277b6be8da6d8d50f9bec3fbcdf6df671416))

## [2.2.1](https://github.com/guidefari/gbfm/compare/v2.2.0...v2.2.1) (2026-01-22)


### Bug Fixes

* only fetch favourites when logged in ([1163f92](https://github.com/guidefari/gbfm/commit/1163f928fd35642a29412e5760619388e03fc63c))

# [2.2.0](https://github.com/guidefari/gbfm/compare/v2.1.0...v2.2.0) (2026-01-22)


### Bug Fixes

* cron job initialisation ([d920a30](https://github.com/guidefari/gbfm/commit/d920a302dfeedbf4b61b037564d97ddd083a7953))
* favouriting tracks ([6e5789c](https://github.com/guidefari/gbfm/commit/6e5789c943bb42c4e3e6fc05d25ca657a4f5486c))
* warning ([2e8ae12](https://github.com/guidefari/gbfm/commit/2e8ae1274891c01e37732855e5611336afeaac91))


### Features

* Add structured Effect logging to services and API handlers, and document implementation progress. ([b0e3740](https://github.com/guidefari/gbfm/commit/b0e3740bbe54f5dc7de7ebce22259a858e18b7bc))
* Implement comprehensive performance monitoring for database queries and HTTP requests with severity-based logging and health checks. ([5cf2da1](https://github.com/guidefari/gbfm/commit/5cf2da1e3e32af3b98583d9bbacc8ec5170a87fd))
* Integrate OpenTelemetry distributed tracing with Effect and add initial service spans. ([47101fb](https://github.com/guidefari/gbfm/commit/47101fb3f5f46e16fd84654085b0efcd5934822b))
* Introduce Effect-based logging middleware and integrate it across the application services. ([27381c1](https://github.com/guidefari/gbfm/commit/27381c14b740db5d526b0af84ae80e18bb5f13f7))

# [2.1.0](https://github.com/guidefari/gbfm/compare/v2.0.2...v2.1.0) (2026-01-18)


### Bug Fixes

* Remove system-wide Pulumi binaries in deploy workflow to prevent conflicts with SST Ion. ([545966c](https://github.com/guidefari/gbfm/commit/545966caa556ce40a306071fc9e8e269b3f81b2b))


### Features

* add Bandcamp URL support to Spotify service ([0a0160f](https://github.com/guidefari/gbfm/commit/0a0160f15bf1c6b37b2bb3d5a874e92e710372fa))
* add HTML fallback parsing for Bandcamp metadata ([f5a1d30](https://github.com/guidefari/gbfm/commit/f5a1d30b13ac893bac0c25c41b576f6ce5e1bdc5))

## [2.0.2](https://github.com/guidefari/gbfm/compare/v2.0.1...v2.0.2) (2026-01-18)


### Bug Fixes

* version bump ([d0cd6c7](https://github.com/guidefari/gbfm/commit/d0cd6c74935e1c456fa62501f99e62b0c359dc0e))

## [2.0.1](https://github.com/guidefari/gbfm/compare/v2.0.0...v2.0.1) (2026-01-18)


### Bug Fixes

* auth client ([b653694](https://github.com/guidefari/gbfm/commit/b653694cd74a7d1fa0c6e0a6467ed0d2377b919d))

# [2.0.0](https://github.com/guidefari/gbfm/compare/v1.10.0...v2.0.0) (2026-01-18)


### Bug Fixes

* update core auth login to use /auth endpoint ([6687db7](https://github.com/guidefari/gbfm/commit/6687db79c7d71b17b63412700e6e3a268b2aa8e4))


### Documentation

* update Effect migration status for Phase 6 content/label handler completion ([040f252](https://github.com/guidefari/gbfm/commit/040f25229d79a00f869cf4dd4bf91ae90dc45655))


### Features

* Add new Effect-based services for labels, audio, music reminders, posts, and releases, and refactor music reminder handlers to use the new service layer. ([09c2d21](https://github.com/guidefari/gbfm/commit/09c2d21952105c97c0512b00e316eabd4ba1a57b))
* complete Phase 5 Effect migration - implement remaining services ([66a0f73](https://github.com/guidefari/gbfm/commit/66a0f73246832b62bf7d84f20881167bbc7ebcf3))
* enhance remaining routes and update migration documentation ([384148d](https://github.com/guidefari/gbfm/commit/384148d30dc6cdd726e74d9262070ff669ff35d4))
* migrate auth handlers to use UserService ([c6cabb7](https://github.com/guidefari/gbfm/commit/c6cabb798019b4ac56ef93441c01b30e71ecde6e))
* migrate auth routes to user routes and update routing ([de02785](https://github.com/guidefari/gbfm/commit/de02785ad5f99a015981bc5ed4c224ec3111f8aa))
* migrate content handlers to use Effect services ([429224f](https://github.com/guidefari/gbfm/commit/429224feaeac464a43eb9931fd8e2fd6a73b8c32))
* migrate processUpload handler to Effect ([8934835](https://github.com/guidefari/gbfm/commit/8934835ed1e51792bb32cafed57ffbc6b2ff291a))
* migrate release handlers to use ReleaseService ([1eafe08](https://github.com/guidefari/gbfm/commit/1eafe080b78d70600348c98986865b2521df7d10))
* update runtime to include new Effect services ([df248b5](https://github.com/guidefari/gbfm/commit/df248b51f3cb7ddeaac3caaaf53f42ace7a6ab97))


### BREAKING CHANGES

* Route improvements may affect internal handler structure
* Runtime now includes additional services that may affect service resolution
* Auth API endpoints moved from /auth to /user
* Auth handlers now use Effect-based services instead of direct database operations
* Release handlers now use Effect-based services instead of direct database operations
* Handler migration continues with type-safe service adoption
* Content handlers now use Effect-based services instead of direct database operations
* Services now use Effect-based functional programming

# [1.10.0](https://github.com/guidefari/gbfm/compare/v1.9.0...v1.10.0) (2026-01-17)


### Bug Fixes

* mutex when processing music reminders ([95826e3](https://github.com/guidefari/gbfm/commit/95826e36ca1ad979b4e3fe1ae337f1315e2e9afa))
* ts errors ([c359120](https://github.com/guidefari/gbfm/commit/c3591207e82add33fca2cbace9044069a0f9689f))
* update nvmrc to current lts ([5916ec2](https://github.com/guidefari/gbfm/commit/5916ec22fbe52bd394013945e82342892660dbe8))


### Features

* admin edit mix ([aa8a04f](https://github.com/guidefari/gbfm/commit/aa8a04f8c65b01d1a5764d80585df69bf319d12f))
* create label ([9872c19](https://github.com/guidefari/gbfm/commit/9872c19860e5a0c0ad7fab79f9cc7b182d14b16d))
* dashboard & profile update ([8291c78](https://github.com/guidefari/gbfm/commit/8291c78c4d2a580653736a167fda0fa0b88c7687))
* favourites ([47bffdd](https://github.com/guidefari/gbfm/commit/47bffdd84aaa06dc76269e87151244f75c2bf8c0))
* lazy scroll ([a023518](https://github.com/guidefari/gbfm/commit/a023518221461f3d879928e0fd8295845da5b20d)), closes [#72](https://github.com/guidefari/gbfm/issues/72)
* music reminder ([a3a1bf8](https://github.com/guidefari/gbfm/commit/a3a1bf8eac0d169a5cade584cf08e950c03c9ac0))
* redirect from auth pages if logged in ([4236b2c](https://github.com/guidefari/gbfm/commit/4236b2cc25f8ebf719479e71825efd2b5c36654b))

# [1.9.0](https://github.com/guidefari/gbfm/compare/v1.8.3...v1.9.0) (2025-12-28)


### Features

* better auth roles ([0c971af](https://github.com/guidefari/gbfm/commit/0c971af299a5006257f70e717b0ea9a89bf8967e))

## [1.8.3](https://github.com/guidefari/gbfm/compare/v1.8.2...v1.8.3) (2025-12-28)


### Bug Fixes

* vps cors def ([deb9940](https://github.com/guidefari/gbfm/commit/deb9940f0d478ed4f3c9ee1901b9c4ca970d0d8d))

## [1.8.2](https://github.com/guidefari/gbfm/compare/v1.8.1...v1.8.2) (2025-12-28)


### Bug Fixes

* explicit cors on gateway ([c0d64cb](https://github.com/guidefari/gbfm/commit/c0d64cbe25cbb3e9ad28f25b0ad3efa870f1887b))
* infta files formatting ([8984fd0](https://github.com/guidefari/gbfm/commit/8984fd075b8a358273e7733a66b4e20f9643fe56))

## [1.8.1](https://github.com/guidefari/gbfm/compare/v1.8.0...v1.8.1) (2025-12-28)


### Bug Fixes

* undo gateway cors change ([4fa1ece](https://github.com/guidefari/gbfm/commit/4fa1ece3057f7229f616a1bde862969403fa520c))

# [1.8.0](https://github.com/guidefari/gbfm/compare/v1.7.0...v1.8.0) (2025-12-28)


### Bug Fixes

* format ([0f86753](https://github.com/guidefari/gbfm/commit/0f86753bfe37ac74844719897eebdc8728e9f667))


### Features

* Dynamically configure CORS origin with `FRONTEND_URL` and remove `www` subdomain from production site URL. ([542f72c](https://github.com/guidefari/gbfm/commit/542f72c8d8cbca9584657ad326ed59e40ed43bbc))

# [1.7.0](https://github.com/guidefari/gbfm/compare/v1.6.2...v1.7.0) (2025-12-27)


### Bug Fixes

* cors ([19ac9d6](https://github.com/guidefari/gbfm/commit/19ac9d6e365155420fac995708993b85e8400f82))


### Features

* new mix upload page ([9cf3b54](https://github.com/guidefari/gbfm/commit/9cf3b541e1b2b1337afff97a79b820642a3e8733))
* style www to be a bit more brutalist ([83a3fc4](https://github.com/guidefari/gbfm/commit/83a3fc407d61d816d69358c805db50a9f20fe163))

## [1.6.2](https://github.com/guidefari/gbfm/compare/v1.6.1...v1.6.2) (2025-12-27)


### Bug Fixes

* better auth cors ([bc4503b](https://github.com/guidefari/gbfm/commit/bc4503b1d95e570525f043ecbcb6a77d5efe102f))

## [1.6.1](https://github.com/guidefari/gbfm/compare/v1.6.0...v1.6.1) (2025-12-27)


### Bug Fixes

* better-auth cors ([33db4bd](https://github.com/guidefari/gbfm/commit/33db4bd3f6f4db5049dd47cf1125ed446f6d6f77))

# [1.6.0](https://github.com/guidefari/gbfm/compare/v1.5.0...v1.6.0) (2025-12-27)


### Bug Fixes

* formating ([00ce618](https://github.com/guidefari/gbfm/commit/00ce61850cca4cd263e9696fd298b0840aa349a4))


### Features

* fix player layout on mixes page ([1ffe28f](https://github.com/guidefari/gbfm/commit/1ffe28f6641024159ad8b78db4d17cd6903ba216))

# [1.5.0](https://github.com/guidefari/gbfm/compare/v1.4.0...v1.5.0) (2025-12-27)


### Features

* layout ([835ab9b](https://github.com/guidefari/gbfm/commit/835ab9b4285a2e654ec7e2baa89a10e9f1c7e5ff))
* nav ([#74](https://github.com/guidefari/gbfm/issues/74)) ([baa5421](https://github.com/guidefari/gbfm/commit/baa5421a6d70951b7ecc21505fd3f7390e459627))

# [1.4.0](https://github.com/guidefari/gbfm/compare/v1.3.0...v1.4.0) (2025-12-27)


### Features

* emanual version bump ([5f32431](https://github.com/guidefari/gbfm/commit/5f324311c18b1651861eb0b36e3c2976d573e2f4))

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
