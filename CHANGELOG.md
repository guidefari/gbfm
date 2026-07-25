## [2.71.1](https://github.com/guidefari/gbfm/compare/v2.71.0...v2.71.1) (2026-07-25)


### Bug Fixes

* **player:** restore position for cached sources ([1053a54](https://github.com/guidefari/gbfm/commit/1053a54a6217a102e3c284aa55ed40d1c7b4ce5b))

# [2.71.0](https://github.com/guidefari/gbfm/compare/v2.70.1...v2.71.0) (2026-07-25)


### Features

* **spotify:** extract shared package and add mobile playback ([#215](https://github.com/guidefari/gbfm/issues/215)) ([4fdf4ab](https://github.com/guidefari/gbfm/commit/4fdf4ab7d24a278e523644b59f06cadfaaf042b2)), closes [#208](https://github.com/guidefari/gbfm/issues/208)

## [2.70.1](https://github.com/guidefari/gbfm/compare/v2.70.0...v2.70.1) (2026-07-25)


### Bug Fixes

* lockfile ([b361ba6](https://github.com/guidefari/gbfm/commit/b361ba6339e8567f2da3365fb63447540d4ae715))
* **tweet:** restore scroll position on back navigation ([c65a8c6](https://github.com/guidefari/gbfm/commit/c65a8c6dd266dc816cb1649ae7ee06103aecae4f))

# [2.70.0](https://github.com/guidefari/gbfm/compare/v2.69.0...v2.70.0) (2026-07-25)


### Bug Fixes

* **music:** destructure status in useAddAdminEntityLink ([21a07af](https://github.com/guidefari/gbfm/commit/21a07af2cb05389b68984d94ec254b1c32ecdfa3))
* **spotify:** attribute Spotify branding on links and playback controls ([3de87e8](https://github.com/guidefari/gbfm/commit/3de87e884d79b5e2847debdf31d801091f1af6b0)), closes [#1DB954](https://github.com/guidefari/gbfm/issues/1DB954)
* **spotify:** compact play/queue buttons, drop redundant badge ([8707ace](https://github.com/guidefari/gbfm/commit/8707acec9f94c3756e2618e8bece682ebbdeed37))
* **spotify:** group entity actions after the platform link list ([a1ba145](https://github.com/guidefari/gbfm/commit/a1ba1459ade6567e5c539306a4af566564b259c8))
* **tweet:** gate music entity card skeleton on links query ([0845629](https://github.com/guidefari/gbfm/commit/08456298448ce3960e613691492e448f5b0e7b51))


### Features

* **observability:** route Effect spans into the existing Sentry tracer ([e09c3fe](https://github.com/guidefari/gbfm/commit/e09c3fed1463ef855fa13406a606f18e86bc6939))
* **spotify:** play and queue music entities from verified links ([d2c978f](https://github.com/guidefari/gbfm/commit/d2c978ff8e3f6b1df03223796f86535c592f1641)), closes [#207](https://github.com/guidefari/gbfm/issues/207) [#209](https://github.com/guidefari/gbfm/issues/209) [#210](https://github.com/guidefari/gbfm/issues/210)

# [2.69.0](https://github.com/guidefari/gbfm/compare/v2.68.0...v2.69.0) (2026-07-25)


### Bug Fixes

* **mobile:** restore active tab contrast ([521d6fe](https://github.com/guidefari/gbfm/commit/521d6fed91919a5c312592aa66094e12b9ac5c8f))


### Features

* **mobile:** add shared screen primitive ([1c085c2](https://github.com/guidefari/gbfm/commit/1c085c23c0f05c2fd3a73bdc31897e24aa1b90ea))
* **theme:** add semantic light-mode tokens ([8d44d8c](https://github.com/guidefari/gbfm/commit/8d44d8cc2ca74791437c2d748c884408ed0a1a49))

# [2.68.0](https://github.com/guidefari/gbfm/compare/v2.67.0...v2.68.0) (2026-07-25)


### Bug Fixes

* **content:** authorize draft management ([2031ddd](https://github.com/guidefari/gbfm/commit/2031dddb8fbaf0b79bd4c02ea8e4cc94ff38c0cd))
* **content:** keep drafts out of public surfaces ([214b322](https://github.com/guidefari/gbfm/commit/214b322efb1bdaf4fcee84097f11cf98a07bf0b4))
* **mobile:** advance playback reliably ([9a3f219](https://github.com/guidefari/gbfm/commit/9a3f2199fe34764f57d1923d5a4f46e786c5cc2d))
* **mobile:** make playback controls accessible ([ae45ab9](https://github.com/guidefari/gbfm/commit/ae45ab917aa53c270230550845672569264d106e))
* **mobile:** make playback queue deterministic ([4cef1a4](https://github.com/guidefari/gbfm/commit/4cef1a4c21ff7a2bcdeb20ec0303524ed13d4e1e))
* **mobile:** synchronize playback intent ([a18de4d](https://github.com/guidefari/gbfm/commit/a18de4db2b37db1d5f7818d717968e121a1bd201))
* **upload:** bind idempotency keys to requests ([f671c48](https://github.com/guidefari/gbfm/commit/f671c48f74cf14af5bd1404a48ba0c16847485ad))
* **upload:** clean up canceled multipart uploads ([a038405](https://github.com/guidefari/gbfm/commit/a0384050c037ef569a1d56d3f63dccca2645cc5a))
* **upload:** enforce retry-safe completion ([0b22e00](https://github.com/guidefari/gbfm/commit/0b22e0091a494ed26abcd233cf2aae292f01030b))


### Features

* **mobile:** confirm queued tracks with a toast ([3ba3897](https://github.com/guidefari/gbfm/commit/3ba38979c9c00a52e15c6c7e357cb3c0a2175ba1))
* **mobile:** redesign now-playing with theme-aware colors ([e14bdc3](https://github.com/guidefari/gbfm/commit/e14bdc3f981f5eb07845123608f5d18bbf15d6f9))

# [2.67.0](https://github.com/guidefari/gbfm/compare/v2.66.0...v2.67.0) (2026-07-23)


### Bug Fixes

* corss header ([0e4a68a](https://github.com/guidefari/gbfm/commit/0e4a68a7e403ba6e5bfcb35be9c30af7faa87aa9))
* corss header ([ee18805](https://github.com/guidefari/gbfm/commit/ee1880542c1f3dd5919101086b376313624091c7))
* **effect:** align Spotify SDK with beta.99 ([3938260](https://github.com/guidefari/gbfm/commit/3938260dbd3d900b523f05844d1a6ab06cd9a7bc))
* **mobile:** sync fonts ready flag in useEffect, not during render ([2729763](https://github.com/guidefari/gbfm/commit/27297637d7fbad3ed860fa51cc746822657222f1))
* use stack options ([50ad623](https://github.com/guidefari/gbfm/commit/50ad6233f0d7e20b04e952580d509d194426d646))
* **www:** import theme tokens via relative path in Vite plugin ([b09d5f7](https://github.com/guidefari/gbfm/commit/b09d5f7c7fc602ef0d440c911d2aebbf97947021))


### Features

* **dev:** expose mobile stack over Tailscale ([487ad8a](https://github.com/guidefari/gbfm/commit/487ad8a99caacf912671545d60786f1eded48388))
* mobile fonts ([e88d0b9](https://github.com/guidefari/gbfm/commit/e88d0b91abb20f8297ef0c4727fda04253bc6a19))
* mobile home page ([a6f84c9](https://github.com/guidefari/gbfm/commit/a6f84c95d7bfda217f70f483a844cad28094af7c))
* **mobile:** add expo-audio provider and secure persistent auth via expo-secure-store ([87b4577](https://github.com/guidefari/gbfm/commit/87b4577be1c7556fe219513cb9c708e14cec19a3))
* **mobile:** add native tabs and appearance settings ([7226210](https://github.com/guidefari/gbfm/commit/72262105498581af662e2b96e3a48bbc1c864c6f))
* **mobile:** add persistent playback queue ([06795bc](https://github.com/guidefari/gbfm/commit/06795bc1973f8c5872b3229393dafd56d71f6ebf))
* **mobile:** add tab layout, now-playing screen, and NowPlayingProvider ([5530048](https://github.com/guidefari/gbfm/commit/5530048753eae0c00b28f32d2ce2b05fb7366a27))
* **mobile:** migrate to @effect/atom-react@4, bump react 19.2.7 and effect 4.0.0-beta.99 ([691e9d8](https://github.com/guidefari/gbfm/commit/691e9d826061f59339151708982c49163fdabc1f))
* **mobile:** redesign home screen with featured mix and update profile with appearance section ([b16aa52](https://github.com/guidefari/gbfm/commit/b16aa529cc60cb84e2f1281261adc90f8fcb61c2))
* **mobile:** refine home screen hierarchy ([64f92e0](https://github.com/guidefari/gbfm/commit/64f92e0b02390607b03f84a17b9dbfbe465b7766))
* **mobile:** use Effect for authentication ([1a199ed](https://github.com/guidefari/gbfm/commit/1a199ed1fc8acaa7305f6dd67256e60a372b0ccd))
* **theme:** export brandDark and brandLight tokens ([c62a8f2](https://github.com/guidefari/gbfm/commit/c62a8f2177bfa5d04cfb6f6d47d0343b43ad540f))

# [2.66.0](https://github.com/guidefari/gbfm/compare/v2.65.4...v2.66.0) (2026-07-18)


### Bug Fixes

* **email:** tighten input validation ([ca45177](https://github.com/guidefari/gbfm/commit/ca4517793255803ce2b3e6f1c3c54523bfc29db3))
* password reset flow - when passwords arent matching ([89fb3fa](https://github.com/guidefari/gbfm/commit/89fb3fad236a8a95e6e0e8368e6d469460dfd6f3))
* **upload:** partNumber must decode from a string in multipart bodies ([1b19994](https://github.com/guidefari/gbfm/commit/1b199940d8a5a8b8fdf1a5b061c182223b54f8ce)), closes [#187](https://github.com/guidefari/gbfm/issues/187)
* **vps:** add missing packages/api copy to Dockerfile ([9ad0050](https://github.com/guidefari/gbfm/commit/9ad005086b83ddd7eb0358b1db82b021b21f7df0))
* **vps:** address adversarial review findings on music album/track/playlist port ([ff48fa0](https://github.com/guidefari/gbfm/commit/ff48fa045c8aec52c663cb685cceccae6f080a53))
* **vps:** address adversarial review findings on music entity-links port ([4191370](https://github.com/guidefari/gbfm/commit/4191370fa8eb61325a5f45029833f59fb84dba23))
* **vps:** auto-default OTel endpoint to localhost in dev stages ([acbf6ea](https://github.com/guidefari/gbfm/commit/acbf6ea5ee5dab530b7d3851079ce7b560ae931e))
* **vps:** avatar upload 400 from Schema.File multipart mismatch ([6a8d78c](https://github.com/guidefari/gbfm/commit/6a8d78c9fa8feb920cc25e8ed1b51e19c79bdb33))
* **vps:** complete resolve HttpApi cutover (Step 6) ([88921f5](https://github.com/guidefari/gbfm/commit/88921f5cbcb13c55ce1f68b71e047fac8ff3fc09)), closes [#161](https://github.com/guidefari/gbfm/issues/161)
* **vps:** confirmInvite as a real HttpApiEndpoint, not a raw route ([8f326b0](https://github.com/guidefari/gbfm/commit/8f326b0a76398f023a81dc0f1fb8e8706cb0158b))
* **vps:** correct music/albums gap attribution, document middleware ordering ([76704a6](https://github.com/guidefari/gbfm/commit/76704a61c0607309a0e1780b962927e3ad7e9f01)), closes [#189](https://github.com/guidefari/gbfm/issues/189)
* **vps:** remove no-op type assertion flagged by oxlint ([0c402d0](https://github.com/guidefari/gbfm/commit/0c402d02da116e9100d3ebca3880de33a2996017)), closes [#151](https://github.com/guidefari/gbfm/issues/151)
* **vps:** restore email/UUID format validation and await on newsletter unsubscribe ([7157dfe](https://github.com/guidefari/gbfm/commit/7157dfe52c0fef52666b406b1c9d49ec0bdecccc))
* **vps:** restore non-empty-string validation on file-manager fields ([36983bc](https://github.com/guidefari/gbfm/commit/36983bc10cf2a482e3f07f04b0c7c6029a21df1e)), closes [#165](https://github.com/guidefari/gbfm/issues/165) [#166](https://github.com/guidefari/gbfm/issues/166)
* **vps:** restore UUID format validation on favorites audioId/showId ([72d40fc](https://github.com/guidefari/gbfm/commit/72d40fc1c1be51ec09d7ee5103e7216a28cfc473))
* **vps:** restore UUID validation on shows subscribe/unsubscribe id param ([a5c19d0](https://github.com/guidefari/gbfm/commit/a5c19d0fdb5ecabd124bf975a90ee74ec99852a9))
* **vps:** tighten email validation to match zod's z.email() ([bf6b12f](https://github.com/guidefari/gbfm/commit/bf6b12fb61eafbf06a45704a1760f7dbe2229269)), closes [#170](https://github.com/guidefari/gbfm/issues/170)
* **vps:** use real URL parsing for spotify enrich endpoint ([b2dbadb](https://github.com/guidefari/gbfm/commit/b2dbadb981bdebc67f8e1dca61bfa77a1a1fccad))
* **www:** convert Date fields before sending artist metadata updates ([df07f39](https://github.com/guidefari/gbfm/commit/df07f39e7891a21604c49f6d8b4c0c2abd234701)), closes [#184](https://github.com/guidefari/gbfm/issues/184)
* **www:** make 'Resend email' link visibly clickable ([77cdbe1](https://github.com/guidefari/gbfm/commit/77cdbe1d047b1896b859f371003baffa360682b7))
* **www:** wire SocialLinksCard into the actual profile route ([8a7eb11](https://github.com/guidefari/gbfm/commit/8a7eb11d3574952d668c2a5a2251cb4485c94390))


### Features

* **api:** scaffold packages/api with health group contract ([c9b5235](https://github.com/guidefari/gbfm/commit/c9b523532c2cfcbc148ff141ddce9f3650b16f23))
* **email:** port email vertical slice ([36913ab](https://github.com/guidefari/gbfm/commit/36913abcc48ad1a1afd45007e32edb59359e94fa))
* **vps:** add unused Effect toWebHandler + Hono fallback (Step 2a) ([9899df5](https://github.com/guidefari/gbfm/commit/9899df5459f9425345dd122086296e32241d9fd8))
* **vps:** dual-export traces to motel alongside Jaeger ([3a59df8](https://github.com/guidefari/gbfm/commit/3a59df8a3f1b2095804f0cd889cc0cd8b9eb6755))
* **vps:** move CORS/rate-limit/logging/Sentry to Effect global middleware, remove HonoFallback (Step 8) ([cfb13e8](https://github.com/guidefari/gbfm/commit/cfb13e858273506322ad2f1f07b1fabb924b5c4d))
* **vps:** port admin to HttpApiBuilder.group (Step 6) ([b0ec807](https://github.com/guidefari/gbfm/commit/b0ec8072526479ecfdcee2ed47df772a8f8d3175))
* **vps:** port audio group to HttpApiBuilder (step 6) ([0539002](https://github.com/guidefari/gbfm/commit/053900228d4740ce6bb477943a714f7ed04aa223))
* **vps:** port auth middleware to HttpApiMiddleware (Step 3b) ([28ffae7](https://github.com/guidefari/gbfm/commit/28ffae786d9913a21cdb2eabb3e7beb1f81c3171))
* **vps:** port better-auth route onto the Effect router (Step 2c) ([300b58c](https://github.com/guidefari/gbfm/commit/300b58cd705050a79c500aa26d013dcbb41db306))
* **vps:** port favorites to HttpApiBuilder.group (Step 6) ([e82ef4f](https://github.com/guidefari/gbfm/commit/e82ef4f11eb074e03bc230e6bff0c35861c06f34))
* **vps:** port file-manager to HttpApiBuilder.group (Step 6) ([54ba078](https://github.com/guidefari/gbfm/commit/54ba078f551fc81be44da69bc0c70cf9b8e40ef5))
* **vps:** port health to HttpApiBuilder.group (Step 3a) ([bca15fb](https://github.com/guidefari/gbfm/commit/bca15fb29d6dd3d0c8baba61793372d1d078b6b8))
* **vps:** port invite to HttpApiBuilder.group (Step 6) ([65a091a](https://github.com/guidefari/gbfm/commit/65a091a780f409b2a2d9b437fde5e3177abeebba))
* **vps:** port label group to HttpApiBuilder (step 6) ([d438195](https://github.com/guidefari/gbfm/commit/d438195a58eb14dd0be5d8b300b68296d9a26e19))
* **vps:** port music albums/tracks/playlists CRUD to HttpApiBuilder.group (Step 6c) ([40873cf](https://github.com/guidefari/gbfm/commit/40873cf8f60383d144c7f2659968c44b9d031dfa))
* **vps:** port music entity-links/resolve/scrape/pending-queue (Step 6d) ([7d9ad0c](https://github.com/guidefari/gbfm/commit/7d9ad0c68008133d8942550d52351e5b76386db2)), closes [#191](https://github.com/guidefari/gbfm/issues/191)
* **vps:** port music-artists CRUD to HttpApiBuilder.group (Step 4) ([18dafca](https://github.com/guidefari/gbfm/commit/18dafca9e30ba986b9512248584d43997e9e83d9))
* **vps:** port music-reminders to HttpApiBuilder.group (Step 6) ([5cc0c45](https://github.com/guidefari/gbfm/commit/5cc0c45a919d756bb587241109e285b57c8fc349))
* **vps:** port newsletter to HttpApiBuilder.group (Step 6) ([eb1a2a6](https://github.com/guidefari/gbfm/commit/eb1a2a63fc690d0992d3c3abf02e97c83c8dd511))
* **vps:** port post group to HttpApiBuilder (step 6) ([374a480](https://github.com/guidefari/gbfm/commit/374a480416825b70c5c8b9b15610b3ad51364ced))
* **vps:** port profile to HttpApiBuilder.group (Step 6) ([095ab24](https://github.com/guidefari/gbfm/commit/095ab24630d0aea600951669ccba3dacd76de683))
* **vps:** port release group to HttpApiBuilder (step 6) ([1db4dd8](https://github.com/guidefari/gbfm/commit/1db4dd88d5833ea1e6dcad2d179062621e153cdc))
* **vps:** port rss/seo/share routes to plain HttpRouter (Step 7) ([24e57e9](https://github.com/guidefari/gbfm/commit/24e57e9aec3098fe0a8e47e3651eadf2613bbdc2))
* **vps:** port search to HttpApiBuilder.group (Step 6) ([d052ce8](https://github.com/guidefari/gbfm/commit/d052ce82e42ea2129c6db4a3e411a76ce34e604e))
* **vps:** port shows to HttpApiBuilder.group (Step 6) ([b8c5d91](https://github.com/guidefari/gbfm/commit/b8c5d91850c4f722b22db4708461eea4b4cdc586))
* **vps:** port spotify to HttpApiBuilder.group (Step 6) ([34ea0a5](https://github.com/guidefari/gbfm/commit/34ea0a5b4ebc82236a2aca112f46d3dd5b225381)), closes [#165](https://github.com/guidefari/gbfm/issues/165) [#166](https://github.com/guidefari/gbfm/issues/166) [#167](https://github.com/guidefari/gbfm/issues/167)
* **vps:** port upload + upload-multipart to HttpApiBuilder.group (Step 7) ([e3b78d4](https://github.com/guidefari/gbfm/commit/e3b78d4b28ab9045bd9aaa3e2cce3ad49da758b3)), closes [175/#184](https://github.com/guidefari/gbfm/issues/184)
* **vps:** port user group to HttpApiBuilder (step 6) ([0fe5c29](https://github.com/guidefari/gbfm/commit/0fe5c29110c767159f304f5379c55e3c345ed2d7))
* **vps:** swap entry point to Effect toWebHandler (Step 2b) ([5454eea](https://github.com/guidefari/gbfm/commit/5454eea191cb04ead82acd63fd3bc0245fac3791))
* **vps:** wire newsletter group into routes.ts/api.ts, delete old Hono trio ([98f8d47](https://github.com/guidefari/gbfm/commit/98f8d4789761f826dfac8eb2f8ba8c0c5eefc948))
* **vps:** wire OtlpLive into AppLayer to export traces ([732e625](https://github.com/guidefari/gbfm/commit/732e625a7e10803098e6de117b659db2b307d17e))
* **www:** add music reminder deletion ([92d6dbb](https://github.com/guidefari/gbfm/commit/92d6dbbef8db3622205784e4f175e38de0f6f20b))
* **www:** add typed HttpApiClient for the music-artists group ([7aa6dd0](https://github.com/guidefari/gbfm/commit/7aa6dd06b6eaf256ed0c4e249fe03f37542b6de9))
* **www:** improve auth navigation ([4a70fd6](https://github.com/guidefari/gbfm/commit/4a70fd6182e1c7d7a1a5c2454da7b144b43ddd94))
* **www:** replace useAdminArtists' fetcher with the typed client ([90b6622](https://github.com/guidefari/gbfm/commit/90b66227bf09660c01b96c1fe71d970c3478d1a1))
* **www:** self-service social links editor in dashboard ([ccb2a38](https://github.com/guidefari/gbfm/commit/ccb2a386efb4cedc7ad41d2f319cc7c938b83ac5))
* **www:** swap admin-group hooks to typed HttpApiClient (step 6b) ([35bfb5b](https://github.com/guidefari/gbfm/commit/35bfb5bd74060d4ddeda54d13b42c5d3e4a8a531))
* **www:** swap audio-group hooks to typed HttpApiClient (step 6b) ([1779b7f](https://github.com/guidefari/gbfm/commit/1779b7fb145c3841c3845fe2c2e91eb6daf8d78d)), closes [#176](https://github.com/guidefari/gbfm/issues/176) [#177](https://github.com/guidefari/gbfm/issues/177) [#175](https://github.com/guidefari/gbfm/issues/175)
* **www:** swap favorites hooks to typed HttpApiClient (step 6b) ([c98bc94](https://github.com/guidefari/gbfm/commit/c98bc94f9adc12e85fd00a54c0d4619fc87c6fe7))
* **www:** swap label+release hooks to typed HttpApiClient (step 6b) ([150031a](https://github.com/guidefari/gbfm/commit/150031a6546ecfcb675b00241881086b8682b2b5)), closes [171/#172](https://github.com/guidefari/gbfm/issues/172)
* **www:** swap music-artist hooks to typed HttpApiClient (step 6b) ([fd0cd90](https://github.com/guidefari/gbfm/commit/fd0cd90b5636228676672dbb8cdcb280583e5ef6))
* **www:** swap newsletter hooks to typed HttpApiClient (step 6b) ([6843733](https://github.com/guidefari/gbfm/commit/684373300d3c703a9d0ae5ca8d215dc21d9c7281))
* **www:** swap newsletter hooks to typed HttpApiClient (step 6b) ([15b4240](https://github.com/guidefari/gbfm/commit/15b4240d0e6e08413a37664feac55e7c29973c87))
* **www:** swap post-group hooks to typed HttpApiClient (step 6b) ([9e86ca7](https://github.com/guidefari/gbfm/commit/9e86ca76ef9c1142ae247e5a9fda6d48cea6254a)), closes [#176](https://github.com/guidefari/gbfm/issues/176)
* **www:** swap resolve slug consumer to typed Effect client (step 6b) ([d8ebe7d](https://github.com/guidefari/gbfm/commit/d8ebe7d3c5366eff97fd8463050b4e8e5162266a))
* **www:** swap search + profile consumers to typed Effect client (step 6b) ([d1179a8](https://github.com/guidefari/gbfm/commit/d1179a8f16e64bea98772aa68073ead80194cbe7))
* **www:** swap shows-group hooks to typed HttpApiClient (step 6b) ([0c1f9bb](https://github.com/guidefari/gbfm/commit/0c1f9bb1cd31a5fd3342a8af03cc03c86dce1710))
* **www:** swap spotify hooks to typed HttpApiClient (step 6b) ([fb238c7](https://github.com/guidefari/gbfm/commit/fb238c73af8973e6619f251ec58bade83348320a))
* **www:** swap user-group hooks to typed HttpApiClient (step 6b) ([7bce140](https://github.com/guidefari/gbfm/commit/7bce140f8ef30c6da248a19bf021d2f57f750255))
* **www:** toast feedback for dashboard profile settings ([11b8edd](https://github.com/guidefari/gbfm/commit/11b8edd1c0cd32d68a3abc3855222fbe3d237fa6))
* **www:** warn when reset-password link is opened with an active session ([b71cb61](https://github.com/guidefari/gbfm/commit/b71cb61b16c1eb149a062e7a302d4917cec664a9))

## [2.65.4](https://github.com/guidefari/gbfm/compare/v2.65.3...v2.65.4) (2026-07-10)


### Bug Fixes

* console warning ([6fa7324](https://github.com/guidefari/gbfm/commit/6fa7324f234dc501d54d24158eb85b0d0b91f432))
* stylez ([dd4a38f](https://github.com/guidefari/gbfm/commit/dd4a38ff4cfde6136ad7015610c78757be2b2f4f))

## [2.65.3](https://github.com/guidefari/gbfm/compare/v2.65.2...v2.65.3) (2026-07-10)


### Bug Fixes

* **www:** apply 60s cache-control to root path, not just *.html ([437cad4](https://github.com/guidefari/gbfm/commit/437cad401264faafdba892d6051e5769a99b63af))

## [2.65.2](https://github.com/guidefari/gbfm/compare/v2.65.1...v2.65.2) (2026-07-10)


### Performance Improvements

* **www:** cache index.html at edge, lazy-load auth dialogs ([#141](https://github.com/guidefari/gbfm/issues/141)) ([23987c5](https://github.com/guidefari/gbfm/commit/23987c5eb67bb0f1376c3aee32f40285dcf3cf54)), closes [#139](https://github.com/guidefari/gbfm/issues/139)

## [2.65.1](https://github.com/guidefari/gbfm/compare/v2.65.0...v2.65.1) (2026-07-10)


### Performance Improvements

* **www:** cut homepage entry bundle 45%, LCP 1.8s -> 1.0s ([#139](https://github.com/guidefari/gbfm/issues/139)) ([d515b76](https://github.com/guidefari/gbfm/commit/d515b76811f65cb1531186bd4ca1f5ac5ef65acb))

# [2.65.0](https://github.com/guidefari/gbfm/compare/v2.64.0...v2.65.0) (2026-07-10)


### Bug Fixes

* **www:** render artwork in webkit tweet exports ([#137](https://github.com/guidefari/gbfm/issues/137)) ([94ec18b](https://github.com/guidefari/gbfm/commit/94ec18b5c41cbf9ffcacb87dd091d4724f4fde1d))


### Features

* **vps:** add granular OTEL spans to slow trace paths ([#138](https://github.com/guidefari/gbfm/issues/138)) ([382f952](https://github.com/guidefari/gbfm/commit/382f952e96b195a55515ad962b9e6bcb975702c9))

# [2.64.0](https://github.com/guidefari/gbfm/compare/v2.63.0...v2.64.0) (2026-07-06)


### Features

* clickable show hostname ([34649d0](https://github.com/guidefari/gbfm/commit/34649d0a40fea6a60de0fa50ac7855451dfb7ab3))

# [2.63.0](https://github.com/guidefari/gbfm/compare/v2.62.0...v2.63.0) (2026-07-06)


### Bug Fixes

* **www:** collapse tweet actions into kebab menu, fixes mobile crowding ([31db000](https://github.com/guidefari/gbfm/commit/31db000bff05a6452a682e3a791e1ecf32d7e439))


### Features

* **www:** download tweet as png for socials ([a383799](https://github.com/guidefari/gbfm/commit/a38379967279b00aa981cb4849d25bd77f76dadf))
* **www:** qr code to post url in social exports, drop liner notes label ([96db4e1](https://github.com/guidefari/gbfm/commit/96db4e1044604ad52992f81e272f602e2f4b44b4))

# [2.62.0](https://github.com/guidefari/gbfm/compare/v2.61.0...v2.62.0) (2026-07-04)


### Bug Fixes

* **www:** use highlight-foreground on highlight surfaces ([0879df5](https://github.com/guidefari/gbfm/commit/0879df5603e27048c835f6fd67811031dc9b5a48))


### Features

* **theme:** align light/dark palette with blue brand colors ([7a3cb2e](https://github.com/guidefari/gbfm/commit/7a3cb2e4cc1ff79ebcc05b204b9dbc29045a3254)), closes [#e8eef7](https://github.com/guidefari/gbfm/issues/e8eef7)

# [2.61.0](https://github.com/guidefari/gbfm/compare/v2.60.1...v2.61.0) (2026-07-03)


### Features

* **www:** inline streaming-link verify in tweet composer ([#135](https://github.com/guidefari/gbfm/issues/135)) ([4bc4214](https://github.com/guidefari/gbfm/commit/4bc421483b9a1d4b86f4d4c5ae44da761de7ab9a))

## [2.60.1](https://github.com/guidefari/gbfm/compare/v2.60.0...v2.60.1) (2026-07-01)


### Bug Fixes

* **dev:** serve SPA auth pages and trust localhost origin ([#134](https://github.com/guidefari/gbfm/issues/134)) ([e3c32f5](https://github.com/guidefari/gbfm/commit/e3c32f525a20f754c3ed8d828ca96549ba27d129))
* **www:** resolve auth context before guarding routes and preserve redirect target ([#133](https://github.com/guidefari/gbfm/issues/133)) ([0510949](https://github.com/guidefari/gbfm/commit/0510949e819c1d003a20e70264c1e4717194bcbb))

# [2.60.0](https://github.com/guidefari/gbfm/compare/v2.59.0...v2.60.0) (2026-07-01)


### Features

* **www:** shared logger writes to console and Sentry ([#132](https://github.com/guidefari/gbfm/issues/132)) ([908d2bd](https://github.com/guidefari/gbfm/commit/908d2bd1bbd8a87f3f0e9c094d138b3f0a744fb0))

# [2.59.0](https://github.com/guidefari/gbfm/compare/v2.58.0...v2.59.0) (2026-06-21)


### Features

* onCancelUpload ([9ac2b95](https://github.com/guidefari/gbfm/commit/9ac2b95e4bd438d7d3dd19e34ac1e8e423c776bc))

# [2.58.0](https://github.com/guidefari/gbfm/compare/v2.57.4...v2.58.0) (2026-06-21)


### Features

* draft cont ([7aa1111](https://github.com/guidefari/gbfm/commit/7aa11115f39b8c47aaa4d62a96a87c5040545187))

## [2.57.4](https://github.com/guidefari/gbfm/compare/v2.57.3...v2.57.4) (2026-06-21)


### Bug Fixes

* **vps:** lower multipart chunk size under API Gateway 10MiB limit ([#130](https://github.com/guidefari/gbfm/issues/130)) ([fb8a9d6](https://github.com/guidefari/gbfm/commit/fb8a9d6acc1f22abf025320981aa4bbd54cdba6e))

## [2.57.3](https://github.com/guidefari/gbfm/compare/v2.57.2...v2.57.3) (2026-06-21)


### Bug Fixes

* **www:** move Sentry.init to module-level in main.tsx ([#129](https://github.com/guidefari/gbfm/issues/129)) ([b52fbef](https://github.com/guidefari/gbfm/commit/b52fbefd4641282d4c3809f24ee66dc541814b6f))

## [2.57.2](https://github.com/guidefari/gbfm/compare/v2.57.1...v2.57.2) (2026-06-21)


### Bug Fixes

* **www:** send credentials on resumable upload requests ([#128](https://github.com/guidefari/gbfm/issues/128)) ([e452925](https://github.com/guidefari/gbfm/commit/e45292573b96bd89b556494ce79a9bdfe0f04ab4))

## [2.57.1](https://github.com/guidefari/gbfm/compare/v2.57.0...v2.57.1) (2026-06-21)


### Bug Fixes

* circular dep ([4941572](https://github.com/guidefari/gbfm/commit/4941572222c4220a0e90a94bfe5d89d97dd96930))

# [2.57.0](https://github.com/guidefari/gbfm/compare/v2.56.0...v2.57.0) (2026-06-21)


### Features

* **upload:** resumable chunked mix audio upload ([#126](https://github.com/guidefari/gbfm/issues/126)) ([cc25ff3](https://github.com/guidefari/gbfm/commit/cc25ff3fecd01458268360b675d15ded929fe43a))

# [2.56.0](https://github.com/guidefari/gbfm/compare/v2.55.0...v2.56.0) (2026-06-21)


### Features

* images cleanup ([946853a](https://github.com/guidefari/gbfm/commit/946853a64592bbdcf8970fc39a809890eefb6935))

# [2.55.0](https://github.com/guidefari/gbfm/compare/v2.54.0...v2.55.0) (2026-06-16)


### Bug Fixes

* **shows:** align selected show hero with sidebar top ([73b8bcb](https://github.com/guidefari/gbfm/commit/73b8bcb9f767e1eaee6324a7f9d50ed2244cd888))
* **user:** persist admin user image via app-owned profile route ([1581120](https://github.com/guidefari/gbfm/commit/158112064c1c7de79e40a767e016d216bd854194))


### Features

* **admin:** edit mix and post metadata from the content tab ([d5d4162](https://github.com/guidefari/gbfm/commit/d5d41629bdcd03b138ec0513fe258dbe8458b230))
* **mix-upload:** pick audio and artwork from S3 media picker ([a5086c1](https://github.com/guidefari/gbfm/commit/a5086c10d220d1eda482805206a7a41ec864b9d2))
* **shows:** browse mixes inline with a selectable show list ([f75a021](https://github.com/guidefari/gbfm/commit/f75a021939f74c772c2a7dba900632ebaa200e2a))

# [2.54.0](https://github.com/guidefari/gbfm/compare/v2.53.0...v2.54.0) (2026-06-15)


### Bug Fixes

* instrumenting ([fe60644](https://github.com/guidefari/gbfm/commit/fe60644085739a18a0d3f9112d7fdfba91d6c392))
* playlists ui ([9e80211](https://github.com/guidefari/gbfm/commit/9e802119d004550a09499d730242b89064fb6945))


### Features

* **auth:** notify admin on signup ([549de15](https://github.com/guidefari/gbfm/commit/549de155aa11d69d94d31f792c0a8461181cafa9))
* nav ([c595514](https://github.com/guidefari/gbfm/commit/c595514749e4257c6b1b898cd20bdaf12baefe80))
* opt new users into newsletter ([a269f14](https://github.com/guidefari/gbfm/commit/a269f14070213a365717602a28beb51a83df055c))
* search ([9e56af2](https://github.com/guidefari/gbfm/commit/9e56af22cd5527175bfa7cac32a6d065bc930dc1))
* **www:** add dashboard routes ([15ceb13](https://github.com/guidefari/gbfm/commit/15ceb135aa9f1a45eee6dbfaaf01a9a0fd616703))
* **www:** reshape dashboard navigation ([07481b7](https://github.com/guidefari/gbfm/commit/07481b751709b83da118ebc67201e370c3bcfb15))

# [2.53.0](https://github.com/guidefari/gbfm/compare/v2.52.0...v2.53.0) (2026-06-14)


### Bug Fixes

* **theme:** add explicit .ts extensions for Node ESM resolution ([cc0981e](https://github.com/guidefari/gbfm/commit/cc0981e0215386193a0f5197b63090c7053490f7))
* **ui:** use foreground color for form input text and caret ([64c4f25](https://github.com/guidefari/gbfm/commit/64c4f2595160a5fbcd16dc8126eeb5db55089625))
* **www:** use dvh and safe-area-inset for iOS Safari layout ([cc7e9af](https://github.com/guidefari/gbfm/commit/cc7e9af4285f5caf1da96bc09f8dccc83b312428))


### Features

* **gbpm:** add --version and --help flags, suppress ffmpeg stderr on success ([d972718](https://github.com/guidefari/gbfm/commit/d97271843db355732abd17e66e02f890daab2ec2))
* **theme:** add backgroundHex token for theme-color meta tags ([6dfc274](https://github.com/guidefari/gbfm/commit/6dfc27414b463db7d83534f65654fe8745ddef91))
* **tools:** add Rust process-mix CLI ([7ac955d](https://github.com/guidefari/gbfm/commit/7ac955d892544869a1065529168321d2c890bb04))
* **www:** add theme-colors Vite plugin for index.html ([8c2b7a2](https://github.com/guidefari/gbfm/commit/8c2b7a21101cf31cfddcacaaa55f8a5743409bba))
* **www:** admin sidebar nav and dedicated tab routes ([9992e4a](https://github.com/guidefari/gbfm/commit/9992e4a735ee6fc14f29311a25259745ec09efd8))
* **www:** keyboard-navigable floating menu tiles ([7521b60](https://github.com/guidefari/gbfm/commit/7521b60e5ffe27f2e4f2cd2f823c39e074a57f31))
* **www:** sync theme-color meta with ThemeProvider ([20b993f](https://github.com/guidefari/gbfm/commit/20b993f81c8662490dd7ce920cbb3cceb06687a4))

# [2.53.0](https://github.com/guidefari/gbfm/compare/v2.52.0...v2.53.0) (2026-06-14)


### Bug Fixes

* **theme:** add explicit .ts extensions for Node ESM resolution ([cc0981e](https://github.com/guidefari/gbfm/commit/cc0981e0215386193a0f5197b63090c7053490f7))
* **www:** use dvh and safe-area-inset for iOS Safari layout ([cc7e9af](https://github.com/guidefari/gbfm/commit/cc7e9af4285f5caf1da96bc09f8dccc83b312428))


### Features

* **gbpm:** add --version and --help flags, suppress ffmpeg stderr on success ([d972718](https://github.com/guidefari/gbfm/commit/d97271843db355732abd17e66e02f890daab2ec2))
* **theme:** add backgroundHex token for theme-color meta tags ([6dfc274](https://github.com/guidefari/gbfm/commit/6dfc27414b463db7d83534f65654fe8745ddef91))
* **tools:** add Rust process-mix CLI ([7ac955d](https://github.com/guidefari/gbfm/commit/7ac955d892544869a1065529168321d2c890bb04))
* **www:** add theme-colors Vite plugin for index.html ([8c2b7a2](https://github.com/guidefari/gbfm/commit/8c2b7a21101cf31cfddcacaaa55f8a5743409bba))
* **www:** sync theme-color meta with ThemeProvider ([20b993f](https://github.com/guidefari/gbfm/commit/20b993f81c8662490dd7ce920cbb3cceb06687a4))

# [2.53.0](https://github.com/guidefari/gbfm/compare/v2.52.0...v2.53.0) (2026-06-14)


### Bug Fixes

* **theme:** add explicit .ts extensions for Node ESM resolution ([cc0981e](https://github.com/guidefari/gbfm/commit/cc0981e0215386193a0f5197b63090c7053490f7))
* **www:** use dvh and safe-area-inset for iOS Safari layout ([cc7e9af](https://github.com/guidefari/gbfm/commit/cc7e9af4285f5caf1da96bc09f8dccc83b312428))


### Features

* **theme:** add backgroundHex token for theme-color meta tags ([6dfc274](https://github.com/guidefari/gbfm/commit/6dfc27414b463db7d83534f65654fe8745ddef91))
* **tools:** add Rust process-mix CLI ([7ac955d](https://github.com/guidefari/gbfm/commit/7ac955d892544869a1065529168321d2c890bb04))
* **www:** add theme-colors Vite plugin for index.html ([8c2b7a2](https://github.com/guidefari/gbfm/commit/8c2b7a21101cf31cfddcacaaa55f8a5743409bba))
* **www:** sync theme-color meta with ThemeProvider ([20b993f](https://github.com/guidefari/gbfm/commit/20b993f81c8662490dd7ce920cbb3cceb06687a4))

# [2.52.0](https://github.com/guidefari/gbfm/compare/v2.51.0...v2.52.0) (2026-06-13)


### Bug Fixes

* **ci:** add vitest include pattern and fix allowedHosts type ([7f9995a](https://github.com/guidefari/gbfm/commit/7f9995a6ec8f3c85a78ff8be5f3f5b0e3f91779d))
* **infra:** clear VITE_VPS_BASE_URL for local dev ([2e62545](https://github.com/guidefari/gbfm/commit/2e6254571782283479083fa6edc5b1c182bd4abb))
* remove reference to missing otel.ts ([65ac2fd](https://github.com/guidefari/gbfm/commit/65ac2fd1bf4552cd54a9fe020335087eed815129))
* **vps:** handle missing SST resources gracefully ([448edb5](https://github.com/guidefari/gbfm/commit/448edb5e5548b82d0bc7b25838f534ae3e9fc3cc))


### Features

* **www:** proxy API requests through Vite dev server ([cdff26f](https://github.com/guidefari/gbfm/commit/cdff26fd8568b1195464653c79fec8a9a917332e))

# [2.51.0](https://github.com/guidefari/gbfm/compare/v2.50.4...v2.51.0) (2026-05-31)


### Bug Fixes

* **sentry:** reduce local analytics noise ([613127b](https://github.com/guidefari/gbfm/commit/613127b9c95b88c53ea1a0944e5a3a5eea2fcc73))
* **www:** batch playlist saved-track checks ([499e1c4](https://github.com/guidefari/gbfm/commit/499e1c4f7e3884295804e50aaf7df94ee416f485))


### Features

* **www:** add creator actions to dashboard ([96ac92c](https://github.com/guidefari/gbfm/commit/96ac92c9680e85a679b3d71041f7a75b12f5136c))

## [2.50.4](https://github.com/guidefari/gbfm/compare/v2.50.3...v2.50.4) (2026-05-31)

### Bug Fixes

- duplicate req ([bb1102c](https://github.com/guidefari/gbfm/commit/bb1102ceeaf18367ffc0d22a453046f1214eb5f1))
- **www:** duplicate req cont. ([96cfcd4](https://github.com/guidefari/gbfm/commit/96cfcd44056260cd42a67c7f87d8d9e8058f92ce))

## [2.50.3](https://github.com/guidefari/gbfm/compare/v2.50.2...v2.50.3) (2026-05-26)

### Bug Fixes

- **cors:** add sentry headers ([86ecbf2](https://github.com/guidefari/gbfm/commit/86ecbf2c0abda3d2c5641e30eadf443e6f715b10))

## [2.50.2](https://github.com/guidefari/gbfm/compare/v2.50.1...v2.50.2) (2026-05-26)

### Bug Fixes

- apply biome formatting to pass CI lint check ([#115](https://github.com/guidefari/gbfm/issues/115)) ([f34772a](https://github.com/guidefari/gbfm/commit/f34772a71e7934f26caca6433f9b10ccbebc43b9))

## [2.50.1](https://github.com/guidefari/gbfm/compare/v2.50.0...v2.50.1) (2026-05-25)

### Bug Fixes

- **tweet:** restore titles and shorten slugs ([33e9702](https://github.com/guidefari/gbfm/commit/33e97021995f144932a26fb199144a12c5578a5e))

# [2.50.0](https://github.com/guidefari/gbfm/compare/v2.49.0...v2.50.0) (2026-05-25)

### Bug Fixes

- replaced search.token! with a guarded mutation ([9fcf975](https://github.com/guidefari/gbfm/commit/9fcf9758e19b6feb2f1e9b02ef7a5c17c17759e2))

### Features

- **design:** newsletter page ([64eb243](https://github.com/guidefari/gbfm/commit/64eb24339866103ea67a12c7ffab2ab1689d765e))
- password reset flow ([9d621f3](https://github.com/guidefari/gbfm/commit/9d621f399c1a5d97fb491fdaec11d424edaf4864))

# [2.49.0](https://github.com/guidefari/gbfm/compare/v2.48.0...v2.49.0) (2026-05-24)

### Features

- **admin:** add newsletter subscribers tab ([080c07a](https://github.com/guidefari/gbfm/commit/080c07a07dc3e1802b61d4f2f03f6caf639879fe))
- **email:** add personal newsletter welcome email with reply-to support ([eab6f81](https://github.com/guidefari/gbfm/commit/eab6f8136b3e9240a2e20a341e0c00eb2048f50d))
- **newsletter:** add email-based unsubscribe flow ([b2dd9f3](https://github.com/guidefari/gbfm/commit/b2dd9f3059f31649af4a7272bfcb544a1504c5d7))
- **newsletter:** collect optional name on subscribe ([6a00921](https://github.com/guidefari/gbfm/commit/6a00921a1c23dfcbd254b626a5be70c801b3b493))

# [2.48.0](https://github.com/guidefari/gbfm/compare/v2.47.0...v2.48.0) (2026-05-24)

### Bug Fixes

- **backup:** use direct port 5432, typed errors for email alerts ([9aa97ee](https://github.com/guidefari/gbfm/commit/9aa97ee2700892a83d0e38667902bd624b1f724b))
- dockerfile ([5eb7a3d](https://github.com/guidefari/gbfm/commit/5eb7a3dc9b68f3a76e96c4b2e431fc02a94abab3))
- **docker:** upgrade backup task to postgresql18-client ([a097693](https://github.com/guidefari/gbfm/commit/a097693d25f5c252743790f28ae0b56c91a46c16))
- **vps:** switch sentry tracing to bun preload ([592ff15](https://github.com/guidefari/gbfm/commit/592ff15e896f630f637660cc2a0c2b556960fa72))

### Features

- **backup:** add verify-backup script and dev commands ([87a3c4c](https://github.com/guidefari/gbfm/commit/87a3c4ca9692712825bd9707f695aa28cf33adf0))

# [2.47.0](https://github.com/guidefari/gbfm/compare/v2.46.0...v2.47.0) (2026-05-24)

### Bug Fixes

- **vps-tracing:** add parent span. ([292b700](https://github.com/guidefari/gbfm/commit/292b70073439dde6a24f2ad9b5de456109edb681))

### Features

- **vps-health:** cache responses ([b0e9e0c](https://github.com/guidefari/gbfm/commit/b0e9e0cbc3eac3c1798c95644ee33411e3d7c96b))
- **vps-health:** split live and ready check ([78a2169](https://github.com/guidefari/gbfm/commit/78a21695e2f73b9394e07f0eb81a7527be91c6db))

# [2.46.0](https://github.com/guidefari/gbfm/compare/v2.45.1...v2.46.0) (2026-05-24)

### Bug Fixes

- **ci:** gate prod release on docker build ([f9ced51](https://github.com/guidefari/gbfm/commit/f9ced513a5b39efb7c076edfc0e90c3e55b7370a))

### Features

- **db-backup:** minimal integrity check ([091ce72](https://github.com/guidefari/gbfm/commit/091ce72b2062f1da7064beb7992a181090e8f495))
- expire old backups ([9b87da7](https://github.com/guidefari/gbfm/commit/9b87da76135dda7a7aa531528c64018dc1115cf2))

## [2.45.1](https://github.com/guidefari/gbfm/compare/v2.45.0...v2.45.1) (2026-05-24)

### Bug Fixes

- **ci:** trigger prod deploy explicitly ([58df86e](https://github.com/guidefari/gbfm/commit/58df86e27204b34527024b83c0234183d413b55c))

# [2.45.0](https://github.com/guidefari/gbfm/compare/v2.44.0...v2.45.0) (2026-05-24)

### Bug Fixes

- **email:** theme & layout ([d64f932](https://github.com/guidefari/gbfm/commit/d64f932d46f3b3cceb0a45c9c06cef904b912be5))
- test ([e6c4f31](https://github.com/guidefari/gbfm/commit/e6c4f31dcb1d42b4a3e0df0ec698c94943220f2a))

### Features

- network error ui ([aebb1c5](https://github.com/guidefari/gbfm/commit/aebb1c56d284c59d42d92c4f7b1fff6bacbbfb95))
- newsletter improvements ([93690a1](https://github.com/guidefari/gbfm/commit/93690a1e94faa54a1aab4e2731013250671ca9f7))
- ui ([e180f59](https://github.com/guidefari/gbfm/commit/e180f59a09ad19c42bae734986a30f4668ab5e21))
- **vps:** add admin notifications ([d185f9c](https://github.com/guidefari/gbfm/commit/d185f9cd012d9900ab8b3a264f0f67eae79d41e0))
- **www:** split new content capture flows ([0c6e7b1](https://github.com/guidefari/gbfm/commit/0c6e7b1822f1ec599a16a5b1816e329c3f38e285))

# [2.44.0](https://github.com/guidefari/gbfm/compare/v2.43.0...v2.44.0) (2026-05-21)

### Features

- **ux:** tweets ([565c737](https://github.com/guidefari/gbfm/commit/565c737d37d369c7a37c51078d2d64c4d22169f6))

# [2.43.0](https://github.com/guidefari/gbfm/compare/v2.42.0...v2.43.0) (2026-05-21)

### Bug Fixes

- automatically verify manually added links + TS! ([e879b98](https://github.com/guidefari/gbfm/commit/e879b9897a611e80c3f61a6f8fb36f77438b2690))

### Features

- tweets ([97ca3d6](https://github.com/guidefari/gbfm/commit/97ca3d65fd858f277bf3c90e575b7f4e56057f57))

# [2.42.0](https://github.com/guidefari/gbfm/compare/v2.41.0...v2.42.0) (2026-05-17)

### Bug Fixes

- **admin:** move entity detail route out of music catalog nesting ([21e6f01](https://github.com/guidefari/gbfm/commit/21e6f01302fc4c20b8ba658996a13d3fcd365b17))
- dialog animation ([b7dd375](https://github.com/guidefari/gbfm/commit/b7dd375aef6eefcd0d8b5bc702e1c97bcc9791f6))
- **ui:** make playground themes switchable ([a3de85f](https://github.com/guidefari/gbfm/commit/a3de85f2993ce4755a7235a93c10d58e15953fb0))

### Features

- add stream links to tweet card ([0e4b414](https://github.com/guidefari/gbfm/commit/0e4b4142777afca164f49912cc5a356d585fbcb4))
- **admin:** music entity catalog + edit pages ([669879d](https://github.com/guidefari/gbfm/commit/669879d1770dc2713ec2cd0dda3bf62908e3b9a3))
- **db_schema:** defaultAuditFields ([e2e31a4](https://github.com/guidefari/gbfm/commit/e2e31a455763363dd44c6453ef40df89dd162ee9))
- edit music entity links ([b4a5fe2](https://github.com/guidefari/gbfm/commit/b4a5fe2d89d27afc59f6ac3725a817748c2bdac6))
- tweet edit flow ([67067da](https://github.com/guidefari/gbfm/commit/67067da65199b926e44f64ce13d32ed8cd4163e8))
- **ui:** add internal design system playground ([93acdb6](https://github.com/guidefari/gbfm/commit/93acdb6d3ff8786323b5b11f5f9c3d954a41aa95))
- **ui:** music entity detail/edit components + playground panel ([4b4b2fa](https://github.com/guidefari/gbfm/commit/4b4b2fa9a8992d941810e845a5ad95b1cb2754ac))
- **ui:** replace playground with Ladle ([294b9e9](https://github.com/guidefari/gbfm/commit/294b9e913f50a08cf931b79bac507c6ffc0d746a))
- **vps:** integration test infrastructure + music-entity service split ([561fa9b](https://github.com/guidefari/gbfm/commit/561fa9b1ef4e1654d52fcb47f0551c5c90eab01e))
- **www:** add playlists tab to admin/music ([2b9d495](https://github.com/guidefari/gbfm/commit/2b9d495360482e14c41dbf44b932c5aa2fc6da21))

# [2.41.0](https://github.com/guidefari/gbfm/compare/v2.40.1...v2.41.0) (2026-05-13)

### Features

- **admin:** add frontend error simulator ([654680b](https://github.com/guidefari/gbfm/commit/654680b62cbfdd8c882547f26d8c2f24f7ab8604))
- **www:** report API outages to Sentry ([26ffc2c](https://github.com/guidefari/gbfm/commit/26ffc2cd6308740eb334532560a991bc3a83fbe1))

## [2.40.1](https://github.com/guidefari/gbfm/compare/v2.40.0...v2.40.1) (2026-05-12)

### Bug Fixes

- **vps:** Removed the loopback hostname ([7149bbf](https://github.com/guidefari/gbfm/commit/7149bbf9895dd342d83506602ca228301d01dd03))

# [2.40.0](https://github.com/guidefari/gbfm/compare/v2.39.0...v2.40.0) (2026-05-11)

### Bug Fixes

- formatting ([4031b07](https://github.com/guidefari/gbfm/commit/4031b07fee61bffe8e146bc70c5183d17dcf1a3c))
- **infra:** use 127.0.0.1 instead of localhost in CORS and auth origins ([a9649a4](https://github.com/guidefari/gbfm/commit/a9649a410e233bee6fe27461d07bcd70a72d9b28))
- raycast runtime ([fc92d9a](https://github.com/guidefari/gbfm/commit/fc92d9ad14c616dcd26a5c85a10da19b7c72cec9))

### Features

- **vps:** add playlist import and management endpoints ([c7f0c09](https://github.com/guidefari/gbfm/commit/c7f0c0907838c0390f62fb36b60c55c8ffb8bd86))
- **vps:** expose spotifyUrl on playlist payloads ([535ad31](https://github.com/guidefari/gbfm/commit/535ad310a0c000547662ff5aff664805875544e8))
- **vps:** queue Spotify playlist enrichment ([cea1aad](https://github.com/guidefari/gbfm/commit/cea1aadf0b869a31058295d37634d0bb7b54d771))
- **www,vps:** wire Spotify card into playlists and track curator on imports ([3b396a3](https://github.com/guidefari/gbfm/commit/3b396a32d09dbe4c7f58b8bae0c7d60ccc0c58b7))
- **www:** add dedicated admin playlists page with editor ([c2170a7](https://github.com/guidefari/gbfm/commit/c2170a75928c1ac60e0d6356a4ef23fc5cb83920))
- **www:** add Spotify client ID to environment ([72ef629](https://github.com/guidefari/gbfm/commit/72ef629dbe5f51e618e8375f41b7c618e606f3c4))
- **www:** add Spotify PKCE auth library and connection card ([e450129](https://github.com/guidefari/gbfm/commit/e450129b20b2070f44e6e6998d0d9dfcc7eb30fe))
- **www:** queue playlist imports and sync links ([3e77e5a](https://github.com/guidefari/gbfm/commit/3e77e5a602d36a949a07e8704b29296dbea818b7))
- **www:** spotify playlist integration ([7468bdd](https://github.com/guidefari/gbfm/commit/7468bdd3b54b4ae2120a42a86236a76a3c8f98fa))
- **www:** sync changelog content into app ([8d7df6d](https://github.com/guidefari/gbfm/commit/8d7df6d4c9d65e3f536ece57e8d4d1bd2eff12e0))

# [2.39.0](https://github.com/guidefari/gbfm/compare/v2.38.1...v2.39.0) (2026-05-09)

### Bug Fixes

- **www:** place biome suppression on key prop line ([0943e97](https://github.com/guidefari/gbfm/commit/0943e9794eabe5fc92bf0097a6457af0cffd6459))

### Features

- **www:** add tweets and editorial to nav and command palette ([f56f102](https://github.com/guidefari/gbfm/commit/f56f10223abf928ba48c215cabd6ada738437098))
- **www:** refresh tweet post page ([52dcc2a](https://github.com/guidefari/gbfm/commit/52dcc2abe26fa1fa457d4580e5bdc7682502d5bd))

## [2.38.1](https://github.com/guidefari/gbfm/compare/v2.38.0...v2.38.1) (2026-05-09)

### Bug Fixes

- ts ([67e73a7](https://github.com/guidefari/gbfm/commit/67e73a7fe28b9dd9a8dbf486c3920af3e24d6b38))

# [2.38.0](https://github.com/guidefari/gbfm/compare/v2.37.0...v2.38.0) (2026-05-09)

### Features

- **vps:** unified logger with sentry logs fanout ([767d4c9](https://github.com/guidefari/gbfm/commit/767d4c96e7860392f375f5ef4c2065eec56fed11))

# [2.37.0](https://github.com/guidefari/gbfm/compare/v2.36.0...v2.37.0) (2026-05-09)

### Features

- **db:** extend posts with music entity linking ([95e1ff8](https://github.com/guidefari/gbfm/commit/95e1ff8a504ea54b73fb2554d6cdcd98733f099b))
- **music:** add entity resolver endpoint ([1194f1c](https://github.com/guidefari/gbfm/commit/1194f1c09ae09b41b46bb53363d7b41a8472295a))
- sentry BE ([fed2902](https://github.com/guidefari/gbfm/commit/fed2902738d9efc0e40e2caf4bbd5631ae88a2be))
- **www:** add music capture UI for creating posts from URLs ([0f9d13d](https://github.com/guidefari/gbfm/commit/0f9d13dd6ad1594261f4869f29b3adc2fc0e6a45))

# [2.36.0](https://github.com/guidefari/gbfm/compare/v2.35.0...v2.36.0) (2026-05-09)

### Features

- **QoL:** port check before running server ([2b99d94](https://github.com/guidefari/gbfm/commit/2b99d941a491a2f7e41ea22a6d35161a9951133b))

# [2.35.0](https://github.com/guidefari/gbfm/compare/v2.34.2...v2.35.0) (2026-05-08)

### Bug Fixes

- biome schema ([2971027](https://github.com/guidefari/gbfm/commit/2971027508525b22d4ad422afc268306ac077a46))

### Features

- otel cont ([9583761](https://github.com/guidefari/gbfm/commit/9583761463353896025d29d74afabcba15773c7e))

## [2.34.2](https://github.com/guidefari/gbfm/compare/v2.34.1...v2.34.2) (2026-04-28)

### Bug Fixes

- tracklist item highlight ([6c3900b](https://github.com/guidefari/gbfm/commit/6c3900b52bb5645a8e2fecfd65614a5b87caf83c))

## [2.34.1](https://github.com/guidefari/gbfm/compare/v2.34.0...v2.34.1) (2026-04-28)

### Bug Fixes

- **e2e:** theme-toggle session ([44415ff](https://github.com/guidefari/gbfm/commit/44415ff90fc05bc31c9a26be686a4d481a5cfc4a))

# [2.34.0](https://github.com/guidefari/gbfm/compare/v2.33.0...v2.34.0) (2026-04-28)

### Features

- deps ([9d5ef4f](https://github.com/guidefari/gbfm/commit/9d5ef4fecbd13112d2e6472232512815e75652f6))
- tsgo brrrr🚀 ([ada8353](https://github.com/guidefari/gbfm/commit/ada835339f6df3082b6638043439873976fd2e43))

# [2.33.0](https://github.com/guidefari/gbfm/compare/v2.32.0...v2.33.0) (2026-04-28)

### Features

- tailwind upgrade ([f008e8b](https://github.com/guidefari/gbfm/commit/f008e8b0d0b140a789cab40da0aea7d42ae29d17))

# [2.32.0](https://github.com/guidefari/gbfm/compare/v2.31.0...v2.32.0) (2026-04-28)

### Bug Fixes

- dockerfile ([f92358e](https://github.com/guidefari/gbfm/commit/f92358e023576120e43983d51a4529fd331d7222))
- **www:** disable autocap on auth inputs, polish welcome modal mobile ([5d19903](https://github.com/guidefari/gbfm/commit/5d19903042ae71b13d84961a904a212895ec4f3d))
- **www:** make reminder date picker accessible ([d1e06e0](https://github.com/guidefari/gbfm/commit/d1e06e034140e4ed73561c1ca3c30ba7a61d7504))
- **www:** prevent mobile auth horizontal scroll ([91cdf3f](https://github.com/guidefari/gbfm/commit/91cdf3ff47299d29d1d5eabf2d51bca33e6a01c6))
- **www:** reminders datetime picker not opening on desktop ([c6e975d](https://github.com/guidefari/gbfm/commit/c6e975d9f5e81efeb77ff8cd657215d34cab2afd))
- **www:** responsive dashboard layout on mobile ([9ecb59a](https://github.com/guidefari/gbfm/commit/9ecb59aaa4ca3498b8a78b1e4bac5ecac1aaf81c))

### Features

- reminder form improvements ([dc361f0](https://github.com/guidefari/gbfm/commit/dc361f03580e881d2a193c37c05753f09de1d6a3))
- ui ([bb1342c](https://github.com/guidefari/gbfm/commit/bb1342c30b1accb412557a471b96dbf1acb6c3b5))
- **www:** add appearance settings ([4c24b34](https://github.com/guidefari/gbfm/commit/4c24b340040bd8ebe94c71f6e0b92124368b67c8))
- **www:** add reminders to floating nav, restructure dashboard entry points ([4b8f083](https://github.com/guidefari/gbfm/commit/4b8f083426878c3075c6c78573d6139baf8ddea6))

# [2.31.0](https://github.com/guidefari/gbfm/compare/v2.30.0...v2.31.0) (2026-04-27)

### Bug Fixes

- **cmd:** keep keyboard-selected items in view ([d12293a](https://github.com/guidefari/gbfm/commit/d12293ab6282682a7196824081f66221046ee35a))
- **cmd:** polish keyboard handling and footer ([421b54b](https://github.com/guidefari/gbfm/commit/421b54b1654dbecfb74c9073bd73845666232e11))
- tsconfig ([a4c83d3](https://github.com/guidefari/gbfm/commit/a4c83d39ea4a8b52275e41b2eb584cbe0eadaf69))
- verification email ([aea5dd0](https://github.com/guidefari/gbfm/commit/aea5dd032a2f0cb4aa06f9c55a99facc57d2d4de))

### Features

- **auth:** live username availability check on sign-up ([9ade9d2](https://github.com/guidefari/gbfm/commit/9ade9d2fea2007f51ec720a233f8043da956aa2e))
- **auth:** signup ux groundwork ([fec619f](https://github.com/guidefari/gbfm/commit/fec619f1bdd096abb55c2272ef70764f0d2d5e0d))
- **auth:** verify-email banner, signup success state, terms/privacy ([957910e](https://github.com/guidefari/gbfm/commit/957910ea00129a1faf65454364afbbd1757abfb9))
- forgot password ux ([446fc59](https://github.com/guidefari/gbfm/commit/446fc59f70552238ec8c5589b4d668545eff5709))

# [2.30.0](https://github.com/guidefari/gbfm/compare/v2.29.0...v2.30.0) (2026-04-17)

### Bug Fixes

- button styles ([3f35ed6](https://github.com/guidefari/gbfm/commit/3f35ed66eb16040346fa66557f39ed8fed1018b4))

### Features

- **admin:** add overview dashboard ([f127625](https://github.com/guidefari/gbfm/commit/f1276251453b0ba1fe5b70ef6ed5489feee1d6c9))
- invite charlie ([7c3d166](https://github.com/guidefari/gbfm/commit/7c3d1669f8e8a1a14879ad387b68bdfbb717363b))
- list djs ([db2adbb](https://github.com/guidefari/gbfm/commit/db2adbbcc6727ec611b10b8dcfddc544853d56b3))
- ui ([e62a5f8](https://github.com/guidefari/gbfm/commit/e62a5f8fd0c26c99ffc6bec46dfc3fe8aa2c9b63))

# [2.29.0](https://github.com/guidefari/gbfm/compare/v2.28.0...v2.29.0) (2026-03-18)

### Features

- add auth docs to scalar ([e2fa6ea](https://github.com/guidefari/gbfm/commit/e2fa6ea2350a148e2a59c98aee771b428978025f))
- auto-create and link artists during scrape with idempotency ([24206ad](https://github.com/guidefari/gbfm/commit/24206ad44c2d071781d491b39637a45a952aa704))
- **music:** complete platform-agnostic music metadata system ([cb6bc79](https://github.com/guidefari/gbfm/commit/cb6bc791128100da75169ba64e56d980bb14e981))
- platform-agnostic music metadata system ([8f11e70](https://github.com/guidefari/gbfm/commit/8f11e703a69e4e57309468c66cf22dcc7cf5c500))
- remove entityId from scrape endpoint ([cf1b58e](https://github.com/guidefari/gbfm/commit/cf1b58e99871301cbb51392dfb34f2b6b3b71fb7))

# [2.28.0](https://github.com/guidefari/gbfm/compare/v2.27.3...v2.28.0) (2026-03-15)

### Features

- update MixListItem ([d17d4c5](https://github.com/guidefari/gbfm/commit/d17d4c5ba05018765c3af172a7334f509cf2a69c))

## [2.27.3](https://github.com/guidefari/gbfm/compare/v2.27.2...v2.27.3) (2026-03-11)

### Bug Fixes

- **force trigger ci👀:** document ssl redirect loop ([e06f186](https://github.com/guidefari/gbfm/commit/e06f18686eb196f4df421fa4780b334a5d912a44))

## [2.27.2](https://github.com/guidefari/gbfm/compare/v2.27.1...v2.27.2) (2026-03-11)

### Bug Fixes

- backup task dockerfile ([f35f6ba](https://github.com/guidefari/gbfm/commit/f35f6ba08d3823fa487b94db792db1172f42cafe))

## [2.27.1](https://github.com/guidefari/gbfm/compare/v2.27.0...v2.27.1) (2026-03-11)

### Bug Fixes

- biome errors ([903dbfe](https://github.com/guidefari/gbfm/commit/903dbfe62ba7fe1b9c9fd9261b97ce4dbee8d438))
- vps Dockerfile ([d2e6d29](https://github.com/guidefari/gbfm/commit/d2e6d29459a2ad960d5dd1f9b7772fba8841d0c0))

# [2.27.0](https://github.com/guidefari/gbfm/compare/v2.26.1...v2.27.0) (2026-03-07)

### Features

- **seo:** fix sitemap routing, add posts, and add JSON-LD structured data ([2e68fb0](https://github.com/guidefari/gbfm/commit/2e68fb09bfd130ceaecd5b3c45e3e83041aba485))
- **seo:** route sitemap dynamic entries through VPS /s/ pre-render routes ([5410220](https://github.com/guidefari/gbfm/commit/5410220edee8956d1eff0c6932b4afea9fb43999))

## [2.26.1](https://github.com/guidefari/gbfm/compare/v2.26.0...v2.26.1) (2026-03-07)

### Bug Fixes

- play tracking ([5729456](https://github.com/guidefari/gbfm/commit/57294565ff8ba0d06d3630375de995804b8c9d86))

# [2.26.0](https://github.com/guidefari/gbfm/compare/v2.25.0...v2.26.0) (2026-03-06)

### Features

- consolidate shows page ([022042e](https://github.com/guidefari/gbfm/commit/022042eae1d67101cd2b2100df859dac97a03ff9))
- desktop sidenav enhancements ([e7c21bf](https://github.com/guidefari/gbfm/commit/e7c21bf4517e84179353fda38ab7123e6e5446e7))

# [2.25.0](https://github.com/guidefari/gbfm/compare/v2.24.2...v2.25.0) (2026-03-01)

### Features

- **core:** add mix processing module with Effect-based job queue ([7958b38](https://github.com/guidefari/gbfm/commit/7958b38cd23414be587ff712bf0dc72e3dd1c654))
- **raycast:** add process-mix command with async job polling ([f07aaf4](https://github.com/guidefari/gbfm/commit/f07aaf4e5b1c2118a6e9de50b026502b12678c49))
- **vps:** add async mix processing endpoints with job status tracking ([4cc4b4f](https://github.com/guidefari/gbfm/commit/4cc4b4f50ac5ebd0fa2a5a6e0c9b0811b09fd5de))

## [2.24.2](https://github.com/guidefari/gbfm/compare/v2.24.1...v2.24.2) (2026-02-20)

### Bug Fixes

- social icons ([3a98313](https://github.com/guidefari/gbfm/commit/3a98313e73c9c58b9317020ce80317a67345ba33))

## [2.24.1](https://github.com/guidefari/gbfm/compare/v2.24.0...v2.24.1) (2026-02-20)

### Bug Fixes

- **ci:** format ([0686c45](https://github.com/guidefari/gbfm/commit/0686c457b941750e063ba78a648de6be7e1ceffc))

# [2.24.0](https://github.com/guidefari/gbfm/compare/v2.23.0...v2.24.0) (2026-02-20)

### Features

- **design:** init design system ([6ccf038](https://github.com/guidefari/gbfm/commit/6ccf03828cbff262bf5124df4f3cc0206bbb4025))
- **design:** profile page ([1e2f19a](https://github.com/guidefari/gbfm/commit/1e2f19ae5195aa2247829e0252ea32edeb651d4b))
- email logs tab for admin ([3672388](https://github.com/guidefari/gbfm/commit/367238832e34987107d6357b5d9b0154c4bc8bfb))
- **www:** social links on profile ([43b2049](https://github.com/guidefari/gbfm/commit/43b20494c20be32ba6de88f63e4f575790b009b0))

# [2.23.0](https://github.com/guidefari/gbfm/compare/v2.22.1...v2.23.0) (2026-02-18)

### Bug Fixes

- emails ([dc77703](https://github.com/guidefari/gbfm/commit/dc777032c382e5a72e5a8d0bf282269083da5c60))
- sort imports to pass Biome CI checks ([#79](https://github.com/guidefari/gbfm/issues/79)) ([42555d2](https://github.com/guidefari/gbfm/commit/42555d2d5478c227404e93d06e1f5155364cb1c7))

### Features

- invite user flow ([6d24f3d](https://github.com/guidefari/gbfm/commit/6d24f3d71be00b27b438d7c03eb9c909c624370b))

## [2.22.1](https://github.com/guidefari/gbfm/compare/v2.22.0...v2.22.1) (2026-02-17)

### Bug Fixes

- **db:** allow user deletion by updating user FKs to cascade/set null ([af442c7](https://github.com/guidefari/gbfm/commit/af442c7b2e81436fc0b8ff461ce02929ad2e86a0))

# [2.22.0](https://github.com/guidefari/gbfm/compare/v2.21.1...v2.22.0) (2026-02-17)

### Features

- remove publications ([a95683e](https://github.com/guidefari/gbfm/commit/a95683e9e95780157d455c7bd37981170f463be6))

## [2.21.1](https://github.com/guidefari/gbfm/compare/v2.21.0...v2.21.1) (2026-02-16)

### Bug Fixes

- **www:** sync resolve with profile ([f84477b](https://github.com/guidefari/gbfm/commit/f84477bb7e44409a0bc887f13c053cc1b879e6f4))

# [2.21.0](https://github.com/guidefari/gbfm/compare/v2.20.0...v2.21.0) (2026-02-16)

### Features

- clickable link to post author ([dfa680c](https://github.com/guidefari/gbfm/commit/dfa680cabec45140d89b78ebd12596bad1e49ee0))
- restyle mix list item ([9b96ef1](https://github.com/guidefari/gbfm/commit/9b96ef1dc0d3c9f9f742bf86062daff900807ad0))
- **www:** styling (dispatch and profile) ([88e4b12](https://github.com/guidefari/gbfm/commit/88e4b1225102f9dcd69ab41f7094fc34fd36f258))

# [2.20.0](https://github.com/guidefari/gbfm/compare/v2.19.0...v2.20.0) (2026-02-15)

### Features

- create/update post ([84cc06e](https://github.com/guidefari/gbfm/commit/84cc06e6d0b9086cdf50415eca774689c48383aa))

# [2.19.0](https://github.com/guidefari/gbfm/compare/v2.18.0...v2.19.0) (2026-02-13)

### Bug Fixes

- run precommit ([48cd614](https://github.com/guidefari/gbfm/commit/48cd614ff493778051d47a4bc2f5ec0d065f3cbe))
- **www:** extract MixListItem component and fix mobile overflow ([227e3f4](https://github.com/guidefari/gbfm/commit/227e3f479f5dc3dacffd0ef12021b2960692bc6d))

### Features

- analytics wrapper ([0fe55b8](https://github.com/guidefari/gbfm/commit/0fe55b88ed36ca49dd89402d28fe7ae949c622d7))
- local feature flag ([8b91a16](https://github.com/guidefari/gbfm/commit/8b91a16973921f3bf7574136c5bd38c33e2d33c8))
- **www:** use effect (👀) ([fdef587](https://github.com/guidefari/gbfm/commit/fdef58783bc8e02777a3795a8807326132c001c4))

# [2.18.0](https://github.com/guidefari/gbfm/compare/v2.17.0...v2.18.0) (2026-02-13)

### Bug Fixes

- marquee ([14769c5](https://github.com/guidefari/gbfm/commit/14769c5573be064a9c7db27d3a060e5b79162819))

### Features

- audio player improvements ([b98c9c7](https://github.com/guidefari/gbfm/commit/b98c9c71934c48373cfb04fe392bf06a09887e71))

# [2.17.0](https://github.com/guidefari/gbfm/compare/v2.16.0...v2.17.0) (2026-02-13)

### Bug Fixes

- build ([ba2757a](https://github.com/guidefari/gbfm/commit/ba2757ab31c46269dfb0d41b1f3e612ebcaebfab))

### Features

- **vps:** add post by slug endpoint with MDX compilation ([38c8d56](https://github.com/guidefari/gbfm/commit/38c8d56a47c7db725397850fb8a95644c35dc908))
- **vps:** add post share/redirect handler ([0e4750b](https://github.com/guidefari/gbfm/commit/0e4750b7af88e63db10e8913fda992ed5aaace32))
- **www:** add dispatch and pings post routes with show page improvements ([46b1e55](https://github.com/guidefari/gbfm/commit/46b1e55336df6616f402ef6f5bcab8ac9db8e312))

# [2.16.0](https://github.com/guidefari/gbfm/compare/v2.15.0...v2.16.0) (2026-02-10)

### Features

- posts endpoint ([2b22631](https://github.com/guidefari/gbfm/commit/2b226317a1415f1911ed8dec66405d72cdeca7df))

# [2.15.0](https://github.com/guidefari/gbfm/compare/v2.14.0...v2.15.0) (2026-02-10)

### Features

- favourites and subscribing ([67dcde5](https://github.com/guidefari/gbfm/commit/67dcde5aa05cd7489bbc3ed09d1878d96ae2218e))
- favourites/subscribe triggers modal sign up/login ([ff67687](https://github.com/guidefari/gbfm/commit/ff676870a80b980db57b89da6e499db7c8bae1c6))
- onboarding improvements ([ef1de3f](https://github.com/guidefari/gbfm/commit/ef1de3fcc8d2ed17db9d725197160de83c809d05))

# [2.14.0](https://github.com/guidefari/gbfm/compare/v2.13.3...v2.14.0) (2026-02-04)

### Features

- audio player and profile improvements ([e3c36dd](https://github.com/guidefari/gbfm/commit/e3c36ddb52cc895919e40b4b91405ed630546a96))

## [2.13.3](https://github.com/guidefari/gbfm/compare/v2.13.2...v2.13.3) (2026-02-04)

### Bug Fixes

- clickable username on audio player ([e021dc5](https://github.com/guidefari/gbfm/commit/e021dc55dcab51620644fb958fa0e7d09da86ba3))

## [2.13.2](https://github.com/guidefari/gbfm/compare/v2.13.1...v2.13.2) (2026-02-04)

### Bug Fixes

- remove display_username ([7b9aa9b](https://github.com/guidefari/gbfm/commit/7b9aa9b3f9450b65abf24d62b5382eabaa483d04))

## [2.13.1](https://github.com/guidefari/gbfm/compare/v2.13.0...v2.13.1) (2026-02-03)

### Bug Fixes

- force version bump 😛 ([159e33e](https://github.com/guidefari/gbfm/commit/159e33e68bb7d6b2cf0f90135ae66b0e72a1e0c9))

# [2.13.0](https://github.com/guidefari/gbfm/compare/v2.12.0...v2.13.0) (2026-02-03)

### Bug Fixes

- **www:** address critical production issues ([00a9fda](https://github.com/guidefari/gbfm/commit/00a9fda00b73b354cc4330438b79c98e977e7565))

### Features

- **vps:** add rate limiting to public endpoints ([3b428f0](https://github.com/guidefari/gbfm/commit/3b428f0409d4233d379a52a685ba72470285d8b2))

# [2.12.0](https://github.com/guidefari/gbfm/compare/v2.11.0...v2.12.0) (2026-01-30)

### Features

- add `show` support to favourites ([a658638](https://github.com/guidefari/gbfm/commit/a6586386b75b6c9077fea6756c2bc5bb18aff310))
- Implement a cron job to clean up expired QR PDF files from S3 using a new S3 object listing capability. ([4847842](https://github.com/guidefari/gbfm/commit/4847842bb4232cd234275af010ddff0212e0ebf3))
- qr service ([75b6394](https://github.com/guidefari/gbfm/commit/75b639449011f3c876db05e2815d5f8420b7c5ab))
- restrict QR download functionality to admin and creator roles. ([c84d587](https://github.com/guidefari/gbfm/commit/c84d587f8dcc428c5a0d3d8d1dbf82888c926071))

# [2.11.0](https://github.com/guidefari/gbfm/compare/v2.10.0...v2.11.0) (2026-01-29)

### Features

- mix upload ([db49d8f](https://github.com/guidefari/gbfm/commit/db49d8f12e130f7372de49386170f2048a23025f))

# [2.10.0](https://github.com/guidefari/gbfm/compare/v2.9.0...v2.10.0) (2026-01-28)

### Features

- Enhance admin user editing to include username, display name, profile image, email verification, and real-time username availability checks. ([fd308bd](https://github.com/guidefari/gbfm/commit/fd308bd206ac5322c6f5c89c947cbd32f51d7bcd))

# [2.9.0](https://github.com/guidefari/gbfm/compare/v2.8.0...v2.9.0) (2026-01-28)

### Features

- add user search functionality for admin and implement reserved slug generation and validation ([86676b4](https://github.com/guidefari/gbfm/commit/86676b47771061f716317010ea1d0050e861dff9))
- Implement banner image support for shows and enhance host linking with user profiles. ([33edb38](https://github.com/guidefari/gbfm/commit/33edb38fe4b30f71d782a788faa881c5c80bf058))
- Implement newsletter subscription functionality and add an admin tab for show management. ([834ed96](https://github.com/guidefari/gbfm/commit/834ed96bcded36426254cfc44bf87a8a03a76f43))
- implement slug resolution to user profiles or shows and enhance authentication context attachment. ([196161f](https://github.com/guidefari/gbfm/commit/196161fc9f8995bb8e9ccca622f404923da7e83d))
- Redesign show page to include a new banner, detailed header, and structured content sections. ([d13262d](https://github.com/guidefari/gbfm/commit/d13262dc0c9a600d0fc37f3d679466a5f15a5b53))

# [2.8.0](https://github.com/guidefari/gbfm/compare/v2.7.3...v2.8.0) (2026-01-28)

### Features

- Add 'Radio Shows' navigation, enhance mix details with queueing and creator links, and introduce show skeleton loading. ([eba130d](https://github.com/guidefari/gbfm/commit/eba130dc863cf7e0d5c22d7b28c295719deb75b2))

## [2.7.3](https://github.com/guidefari/gbfm/compare/v2.7.2...v2.7.3) (2026-01-28)

### Bug Fixes

- play mix button ([da3c9a3](https://github.com/guidefari/gbfm/commit/da3c9a3a2bea2a51c481cc5be4efc7c6a9468425))

## [2.7.2](https://github.com/guidefari/gbfm/compare/v2.7.1...v2.7.2) (2026-01-28)

### Bug Fixes

- revert to absolute positioning for music player ([cbbc976](https://github.com/guidefari/gbfm/commit/cbbc9769b60f8021af653e3a64edc2866c179099))

## [2.7.1](https://github.com/guidefari/gbfm/compare/v2.7.0...v2.7.1) (2026-01-28)

### Bug Fixes

- formatting ([b9451e1](https://github.com/guidefari/gbfm/commit/b9451e183334f3acaf77fcd225306657fe05965b))
- mobile responsive mixes page ([d1ae448](https://github.com/guidefari/gbfm/commit/d1ae448c4191e92aab8b5dd5fafb21ff775df32f))

# [2.7.0](https://github.com/guidefari/gbfm/compare/v2.6.0...v2.7.0) (2026-01-27)

### Features

- update audio creatorId ([d7eef10](https://github.com/guidefari/gbfm/commit/d7eef1057198757a4716facd0eeb7b5dcf301f4a))

# [2.6.0](https://github.com/guidefari/gbfm/compare/v2.5.0...v2.6.0) (2026-01-27)

### Features

- Implement user display names and admin user creation/management. ([3ff6b33](https://github.com/guidefari/gbfm/commit/3ff6b3328fc7e79cac402687f8977ee95bb46385))

# [2.5.0](https://github.com/guidefari/gbfm/compare/v2.4.0...v2.5.0) (2026-01-27)

### Features

- observability improvements ([3723b98](https://github.com/guidefari/gbfm/commit/3723b98bb6a8a953e91125fb9667069b51600fb4))

# [2.4.0](https://github.com/guidefari/gbfm/compare/v2.3.0...v2.4.0) (2026-01-27)

### Bug Fixes

- effect devtools packages ([59e317e](https://github.com/guidefari/gbfm/commit/59e317e5e0efaee4ae3e066703e21376fb61d17f))
- effect lsp errors ([8375ab2](https://github.com/guidefari/gbfm/commit/8375ab20f298dfdf8e0b847203801c3c0d85a08f))
- effect type errors ([593c21f](https://github.com/guidefari/gbfm/commit/593c21f9debd2dc0669d8e281216988b415749b0))
- export shows schema ([e720e4a](https://github.com/guidefari/gbfm/commit/e720e4aaede3ae07d29e17bae006e90d9fc9fc1b))
- formatting ([6dfabcf](https://github.com/guidefari/gbfm/commit/6dfabcf3af9c3ef8e42903da642e3d1d6bad8f3f))
- more errors highlighted by effect lsp ([01b7536](https://github.com/guidefari/gbfm/commit/01b7536de89ae39ae07fdb800cd530b25ff5b1e0))

### Features

- dev tools ([dfceb5d](https://github.com/guidefari/gbfm/commit/dfceb5d04457cbdebb7a2ac9f79516c49634ed47))
- effect devtools ([189c9b2](https://github.com/guidefari/gbfm/commit/189c9b2a08ada7545426aca9da9e7afc2f247d67))
- landing page ([a08c37d](https://github.com/guidefari/gbfm/commit/a08c37de7f34d22aa87c1a59e64d03f47222870b))
- memory gauge ([db32940](https://github.com/guidefari/gbfm/commit/db32940d7991d15e275853e7e40611ba78cffbec))
- shows backend ([0436146](https://github.com/guidefari/gbfm/commit/0436146c041ba41e8cd284f9472f5a12006a9fd6))
- spans ([3525b47](https://github.com/guidefari/gbfm/commit/3525b470c1785615258a2c5a9ee62a01a2736e23))
- username and public profile ([dca8d78](https://github.com/guidefari/gbfm/commit/dca8d78c2104611db64177fa0676f6d6b19e6842))
- **wip:** Implement show listing, detail pages, and user subscription management for shows. ([132fabf](https://github.com/guidefari/gbfm/commit/132fabf973b96811baadc3f853725acd691b78a9))

# [2.3.0](https://github.com/guidefari/gbfm/compare/v2.2.1...v2.3.0) (2026-01-24)

### Features

- **backup:** extract LogCapture to shared utilities with idiomatic Effect ([e7507dc](https://github.com/guidefari/gbfm/commit/e7507dc0eff43bffd46351a6fafc164a0272f07c))
- preload track ([95a6d22](https://github.com/guidefari/gbfm/commit/95a6d22d24099fdc754a263ddfd43469036bbbb6))
- remiinders styling ([207ed8d](https://github.com/guidefari/gbfm/commit/207ed8d5f161afd8356428b6fb0ed9b992697962))
- **seo:** add SEO to index pages and create sitemap/robots.txt ([c71ca4c](https://github.com/guidefari/gbfm/commit/c71ca4c39895fc410d204d2b6d1542902a1ac144))
- **seo:** add SEO utilities and metadata to dynamic routes ([ea906c4](https://github.com/guidefari/gbfm/commit/ea906c468271833ee6d3edf010132dc86d74b249))
- settngs and dashboard ([eb7e817](https://github.com/guidefari/gbfm/commit/eb7e8170768823e3e8c9250b046a44e78be4a0f0))
- update mixes layout ([4063e27](https://github.com/guidefari/gbfm/commit/4063e276441247f7b2dc8d6790acc149105d5578))
- updateTagsMutation ([3ef1277](https://github.com/guidefari/gbfm/commit/3ef1277b6be8da6d8d50f9bec3fbcdf6df671416))

## [2.2.1](https://github.com/guidefari/gbfm/compare/v2.2.0...v2.2.1) (2026-01-22)

### Bug Fixes

- only fetch favourites when logged in ([1163f92](https://github.com/guidefari/gbfm/commit/1163f928fd35642a29412e5760619388e03fc63c))

# [2.2.0](https://github.com/guidefari/gbfm/compare/v2.1.0...v2.2.0) (2026-01-22)

### Bug Fixes

- cron job initialisation ([d920a30](https://github.com/guidefari/gbfm/commit/d920a302dfeedbf4b61b037564d97ddd083a7953))
- favouriting tracks ([6e5789c](https://github.com/guidefari/gbfm/commit/6e5789c943bb42c4e3e6fc05d25ca657a4f5486c))
- warning ([2e8ae12](https://github.com/guidefari/gbfm/commit/2e8ae1274891c01e37732855e5611336afeaac91))

### Features

- Add structured Effect logging to services and API handlers, and document implementation progress. ([b0e3740](https://github.com/guidefari/gbfm/commit/b0e3740bbe54f5dc7de7ebce22259a858e18b7bc))
- Implement comprehensive performance monitoring for database queries and HTTP requests with severity-based logging and health checks. ([5cf2da1](https://github.com/guidefari/gbfm/commit/5cf2da1e3e32af3b98583d9bbacc8ec5170a87fd))
- Integrate OpenTelemetry distributed tracing with Effect and add initial service spans. ([47101fb](https://github.com/guidefari/gbfm/commit/47101fb3f5f46e16fd84654085b0efcd5934822b))
- Introduce Effect-based logging middleware and integrate it across the application services. ([27381c1](https://github.com/guidefari/gbfm/commit/27381c14b740db5d526b0af84ae80e18bb5f13f7))

# [2.1.0](https://github.com/guidefari/gbfm/compare/v2.0.2...v2.1.0) (2026-01-18)

### Bug Fixes

- Remove system-wide Pulumi binaries in deploy workflow to prevent conflicts with SST Ion. ([545966c](https://github.com/guidefari/gbfm/commit/545966caa556ce40a306071fc9e8e269b3f81b2b))

### Features

- add Bandcamp URL support to Spotify service ([0a0160f](https://github.com/guidefari/gbfm/commit/0a0160f15bf1c6b37b2bb3d5a874e92e710372fa))
- add HTML fallback parsing for Bandcamp metadata ([f5a1d30](https://github.com/guidefari/gbfm/commit/f5a1d30b13ac893bac0c25c41b576f6ce5e1bdc5))

## [2.0.2](https://github.com/guidefari/gbfm/compare/v2.0.1...v2.0.2) (2026-01-18)

### Bug Fixes

- version bump ([d0cd6c7](https://github.com/guidefari/gbfm/commit/d0cd6c74935e1c456fa62501f99e62b0c359dc0e))

## [2.0.1](https://github.com/guidefari/gbfm/compare/v2.0.0...v2.0.1) (2026-01-18)

### Bug Fixes

- auth client ([b653694](https://github.com/guidefari/gbfm/commit/b653694cd74a7d1fa0c6e0a6467ed0d2377b919d))

# [2.0.0](https://github.com/guidefari/gbfm/compare/v1.10.0...v2.0.0) (2026-01-18)

### Bug Fixes

- update core auth login to use /auth endpoint ([6687db7](https://github.com/guidefari/gbfm/commit/6687db79c7d71b17b63412700e6e3a268b2aa8e4))

### Documentation

- update Effect migration status for Phase 6 content/label handler completion ([040f252](https://github.com/guidefari/gbfm/commit/040f25229d79a00f869cf4dd4bf91ae90dc45655))

### Features

- Add new Effect-based services for labels, audio, music reminders, posts, and releases, and refactor music reminder handlers to use the new service layer. ([09c2d21](https://github.com/guidefari/gbfm/commit/09c2d21952105c97c0512b00e316eabd4ba1a57b))
- complete Phase 5 Effect migration - implement remaining services ([66a0f73](https://github.com/guidefari/gbfm/commit/66a0f73246832b62bf7d84f20881167bbc7ebcf3))
- enhance remaining routes and update migration documentation ([384148d](https://github.com/guidefari/gbfm/commit/384148d30dc6cdd726e74d9262070ff669ff35d4))
- migrate auth handlers to use UserService ([c6cabb7](https://github.com/guidefari/gbfm/commit/c6cabb798019b4ac56ef93441c01b30e71ecde6e))
- migrate auth routes to user routes and update routing ([de02785](https://github.com/guidefari/gbfm/commit/de02785ad5f99a015981bc5ed4c224ec3111f8aa))
- migrate content handlers to use Effect services ([429224f](https://github.com/guidefari/gbfm/commit/429224feaeac464a43eb9931fd8e2fd6a73b8c32))
- migrate processUpload handler to Effect ([8934835](https://github.com/guidefari/gbfm/commit/8934835ed1e51792bb32cafed57ffbc6b2ff291a))
- migrate release handlers to use ReleaseService ([1eafe08](https://github.com/guidefari/gbfm/commit/1eafe080b78d70600348c98986865b2521df7d10))
- update runtime to include new Effect services ([df248b5](https://github.com/guidefari/gbfm/commit/df248b51f3cb7ddeaac3caaaf53f42ace7a6ab97))

### BREAKING CHANGES

- Route improvements may affect internal handler structure
- Runtime now includes additional services that may affect service resolution
- Auth API endpoints moved from /auth to /user
- Auth handlers now use Effect-based services instead of direct database operations
- Release handlers now use Effect-based services instead of direct database operations
- Handler migration continues with type-safe service adoption
- Content handlers now use Effect-based services instead of direct database operations
- Services now use Effect-based functional programming

# [1.10.0](https://github.com/guidefari/gbfm/compare/v1.9.0...v1.10.0) (2026-01-17)

### Bug Fixes

- mutex when processing music reminders ([95826e3](https://github.com/guidefari/gbfm/commit/95826e36ca1ad979b4e3fe1ae337f1315e2e9afa))
- ts errors ([c359120](https://github.com/guidefari/gbfm/commit/c3591207e82add33fca2cbace9044069a0f9689f))
- update nvmrc to current lts ([5916ec2](https://github.com/guidefari/gbfm/commit/5916ec22fbe52bd394013945e82342892660dbe8))

### Features

- admin edit mix ([aa8a04f](https://github.com/guidefari/gbfm/commit/aa8a04f8c65b01d1a5764d80585df69bf319d12f))
- create label ([9872c19](https://github.com/guidefari/gbfm/commit/9872c19860e5a0c0ad7fab79f9cc7b182d14b16d))
- dashboard & profile update ([8291c78](https://github.com/guidefari/gbfm/commit/8291c78c4d2a580653736a167fda0fa0b88c7687))
- favourites ([47bffdd](https://github.com/guidefari/gbfm/commit/47bffdd84aaa06dc76269e87151244f75c2bf8c0))
- lazy scroll ([a023518](https://github.com/guidefari/gbfm/commit/a023518221461f3d879928e0fd8295845da5b20d)), closes [#72](https://github.com/guidefari/gbfm/issues/72)
- music reminder ([a3a1bf8](https://github.com/guidefari/gbfm/commit/a3a1bf8eac0d169a5cade584cf08e950c03c9ac0))
- redirect from auth pages if logged in ([4236b2c](https://github.com/guidefari/gbfm/commit/4236b2cc25f8ebf719479e71825efd2b5c36654b))

# [1.9.0](https://github.com/guidefari/gbfm/compare/v1.8.3...v1.9.0) (2025-12-28)

### Features

- better auth roles ([0c971af](https://github.com/guidefari/gbfm/commit/0c971af299a5006257f70e717b0ea9a89bf8967e))

## [1.8.3](https://github.com/guidefari/gbfm/compare/v1.8.2...v1.8.3) (2025-12-28)

### Bug Fixes

- vps cors def ([deb9940](https://github.com/guidefari/gbfm/commit/deb9940f0d478ed4f3c9ee1901b9c4ca970d0d8d))

## [1.8.2](https://github.com/guidefari/gbfm/compare/v1.8.1...v1.8.2) (2025-12-28)

### Bug Fixes

- explicit cors on gateway ([c0d64cb](https://github.com/guidefari/gbfm/commit/c0d64cbe25cbb3e9ad28f25b0ad3efa870f1887b))
- infta files formatting ([8984fd0](https://github.com/guidefari/gbfm/commit/8984fd075b8a358273e7733a66b4e20f9643fe56))

## [1.8.1](https://github.com/guidefari/gbfm/compare/v1.8.0...v1.8.1) (2025-12-28)

### Bug Fixes

- undo gateway cors change ([4fa1ece](https://github.com/guidefari/gbfm/commit/4fa1ece3057f7229f616a1bde862969403fa520c))

# [1.8.0](https://github.com/guidefari/gbfm/compare/v1.7.0...v1.8.0) (2025-12-28)

### Bug Fixes

- format ([0f86753](https://github.com/guidefari/gbfm/commit/0f86753bfe37ac74844719897eebdc8728e9f667))

### Features

- Dynamically configure CORS origin with `FRONTEND_URL` and remove `www` subdomain from production site URL. ([542f72c](https://github.com/guidefari/gbfm/commit/542f72c8d8cbca9584657ad326ed59e40ed43bbc))

# [1.7.0](https://github.com/guidefari/gbfm/compare/v1.6.2...v1.7.0) (2025-12-27)

### Bug Fixes

- cors ([19ac9d6](https://github.com/guidefari/gbfm/commit/19ac9d6e365155420fac995708993b85e8400f82))

### Features

- new mix upload page ([9cf3b54](https://github.com/guidefari/gbfm/commit/9cf3b541e1b2b1337afff97a79b820642a3e8733))
- style www to be a bit more brutalist ([83a3fc4](https://github.com/guidefari/gbfm/commit/83a3fc407d61d816d69358c805db50a9f20fe163))

## [1.6.2](https://github.com/guidefari/gbfm/compare/v1.6.1...v1.6.2) (2025-12-27)

### Bug Fixes

- better auth cors ([bc4503b](https://github.com/guidefari/gbfm/commit/bc4503b1d95e570525f043ecbcb6a77d5efe102f))

## [1.6.1](https://github.com/guidefari/gbfm/compare/v1.6.0...v1.6.1) (2025-12-27)

### Bug Fixes

- better-auth cors ([33db4bd](https://github.com/guidefari/gbfm/commit/33db4bd3f6f4db5049dd47cf1125ed446f6d6f77))

# [1.6.0](https://github.com/guidefari/gbfm/compare/v1.5.0...v1.6.0) (2025-12-27)

### Bug Fixes

- formating ([00ce618](https://github.com/guidefari/gbfm/commit/00ce61850cca4cd263e9696fd298b0840aa349a4))

### Features

- fix player layout on mixes page ([1ffe28f](https://github.com/guidefari/gbfm/commit/1ffe28f6641024159ad8b78db4d17cd6903ba216))

# [1.5.0](https://github.com/guidefari/gbfm/compare/v1.4.0...v1.5.0) (2025-12-27)

### Features

- layout ([835ab9b](https://github.com/guidefari/gbfm/commit/835ab9b4285a2e654ec7e2baa89a10e9f1c7e5ff))
- nav ([#74](https://github.com/guidefari/gbfm/issues/74)) ([baa5421](https://github.com/guidefari/gbfm/commit/baa5421a6d70951b7ecc21505fd3f7390e459627))

# [1.4.0](https://github.com/guidefari/gbfm/compare/v1.3.0...v1.4.0) (2025-12-27)

### Features

- emanual version bump ([5f32431](https://github.com/guidefari/gbfm/commit/5f324311c18b1651861eb0b36e3c2976d573e2f4))

# [1.3.0](https://github.com/guidefari/gbfm/compare/v1.2.0...v1.3.0) (2025-12-27)

### Features

- better auth migration ([0ad61fc](https://github.com/guidefari/gbfm/commit/0ad61fc595dc80b66f9234997d7a445072d4bef0))

# [1.2.0](https://github.com/guidefari/gbfm/compare/v1.1.2...v1.2.0) (2025-12-14)

### Bug Fixes

- remove any ([0e49ef0](https://github.com/guidefari/gbfm/commit/0e49ef03da9b407a7519a50e5f5c9881df8c77e4))

### Features

- audio player wip ([e1c8bab](https://github.com/guidefari/gbfm/commit/e1c8bab50d3b0ca0b7c986fe6b49ed5966b60a20))
- remove shuffle and repeat ([69be785](https://github.com/guidefari/gbfm/commit/69be7851a3e99cf24f170ca6cd3cd958ae12960e))
- render markdown ([c24b019](https://github.com/guidefari/gbfm/commit/c24b01942104aca80db8427b289b0d262c42243a))
- seed rbac ([e2f4a99](https://github.com/guidefari/gbfm/commit/e2f4a99d62f2734520215f21c8d464ef390fac4a))

## [1.1.2](https://github.com/guidefari/gbfm/compare/v1.1.1...v1.1.2) (2025-12-06)

### Bug Fixes

- layer merging ([a1c2f52](https://github.com/guidefari/gbfm/commit/a1c2f52238f9b735ff64c48a2aa61364044795ad))
- queue on full screen audio player ([12e26c8](https://github.com/guidefari/gbfm/commit/12e26c806f236ba4a8dcf2ad457ae34f30b11cb2))

## [1.1.1](https://github.com/guidefari/gbfm/compare/v1.1.0...v1.1.1) (2025-11-23)

### Bug Fixes

- share url ([764ee25](https://github.com/guidefari/gbfm/commit/764ee25bf6ce4be4dcc75a4562d2289231ddcefd))

# [1.1.0](https://github.com/guidefari/gbfm/compare/v1.0.0...v1.1.0) (2025-11-23)

### Features

- Add Open Graph meta tags for link sharing ([#70](https://github.com/guidefari/gbfm/issues/70)) ([9161d49](https://github.com/guidefari/gbfm/commit/9161d490cb1d9329538978b81cee51ccc217d23f))

# [1.0.0](https://github.com/guidefari/gbfm/compare/v0.36.1...v1.0.0) (2025-11-23)

- Add default pagination to VPS GET endpoints ([#68](https://github.com/guidefari/gbfm/issues/68)) ([77fa9d6](https://github.com/guidefari/gbfm/commit/77fa9d6b0caf963465a2ef00d81963a5621e7fde))

### BREAKING CHANGES

- Response format changed from arrays to paginated objects

- chore: Remove migration 0008 for regeneration

Removed migration 0008_next_echo.sql to regenerate it cleanly.
This ensures the migration is properly generated from the current schema state after rebasing with prod.

- fix: Handle count query result properly and fix TypeScript errors

* Fix count() result destructuring - handle potentially undefined first element
* Remove unused 'desc' import from publication handlers (orders by name not createdAt)
* Remove unused 'and' import from label handlers
* All pagination queries now properly handle count results with nullish coalescing
* Publications table orders by name instead of non-existent createdAt field
* Pass typecheck and biome checks

- feat: Update UI clients to support pagination

* Updated www app API client (http.ts) to use useInfiniteQuery for paginated endpoints
* Added pagination controls to mixes, tracks, and labels list pages
* Added "Load More" functionality to label detail page releases
* Updated Raycast extension to automatically load all pages on mount
* All clients now support the new paginated API response format

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

- posthog configs ([25e082b](https://github.com/guidefari/gbfm/commit/25e082b4597d9748c363b4aef635b24bcd1192fa))

# [0.36.0](https://github.com/guidefari/gbfm/compare/v0.35.0...v0.36.0) (2025-11-23)

### Features

- posthog ([7a1e609](https://github.com/guidefari/gbfm/commit/7a1e6090158f8c019afbacf61465550e43281db2))

# [0.35.0](https://github.com/guidefari/gbfm/compare/v0.34.0...v0.35.0) (2025-11-23)

### Features

- Create database backup scripts ([#64](https://github.com/guidefari/gbfm/issues/64)) ([467afaa](https://github.com/guidefari/gbfm/commit/467afaa39904a04cf9e7821a4af9458e1ff5f315))

# [0.34.0](https://github.com/guidefari/gbfm/compare/v0.33.0...v0.34.0) (2025-11-03)

### Features

- send mix notification ([ab55950](https://github.com/guidefari/gbfm/commit/ab55950f4a628f23f9e1a03678c3d36e784cbb3a))

# [0.33.0](https://github.com/guidefari/gbfm/compare/v0.32.0...v0.33.0) (2025-10-26)

### Features

- mix page metadata ([0e2dfea](https://github.com/guidefari/gbfm/commit/0e2dfeaf953b0129a108c312317fec1bb5139259))

# [0.32.0](https://github.com/guidefari/gbfm/compare/v0.31.0...v0.32.0) (2025-10-26)

### Features

- application level query timer ([7349957](https://github.com/guidefari/gbfm/commit/7349957273174e121fa938ea60a5b1ec6650f7af))
- new mix notification email ([6c69212](https://github.com/guidefari/gbfm/commit/6c69212b2ad7e5f2557c68c0ac3d429560b676ea))

# [0.31.0](https://github.com/guidefari/gbfm/compare/v0.30.1...v0.31.0) (2025-10-26)

### Bug Fixes

- ci cache hash file ([6a2f2bb](https://github.com/guidefari/gbfm/commit/6a2f2bb8ae7996fdfc230b0bf6c8e358f65ad5b5))
- date types ([9e44dae](https://github.com/guidefari/gbfm/commit/9e44daeba51249243c54c709cc4e927168abe8c8))
- ts ([32b0ae3](https://github.com/guidefari/gbfm/commit/32b0ae353749052ebd9bf2e64d5a6fbb083c01b0))
- ts ([1a6ae1e](https://github.com/guidefari/gbfm/commit/1a6ae1ed8f4079a6ef9e7eea74f598b274bb33b5))
- ts ([49ca97b](https://github.com/guidefari/gbfm/commit/49ca97bef57dee98f354a5d62a35b0899a43b726))
- ts. ffs. ([ba9239f](https://github.com/guidefari/gbfm/commit/ba9239f82f63e36238696949878cfdc3cacfe878))
- validate limit values for spotify pagination ([0f522e7](https://github.com/guidefari/gbfm/commit/0f522e7dc4bdccf1c64c1de902a2cfb6074c964f))
- **vps:** zod skill issue ([50ed57e](https://github.com/guidefari/gbfm/commit/50ed57ec6a76e188667eaf8c0576e6198b52fecf))

### Features

- fetch client (to be replaced by something that's automated pls) ([98bc9eb](https://github.com/guidefari/gbfm/commit/98bc9eb7fd17c7572b848240b2e09987fcff3848))
- labels admin cms ([d0ce2b8](https://github.com/guidefari/gbfm/commit/d0ce2b860e9b1b8ba5f8bc38b5c1a56dca2843e0))
- quick share ([d06d62b](https://github.com/guidefari/gbfm/commit/d06d62b3040db2a63b243f144ea10088f0ad313d))
- release ([d5fd319](https://github.com/guidefari/gbfm/commit/d5fd319a44a9eeab08926cc8b478e699e835c080))
- wip react-native fps meter ([d9a2be5](https://github.com/guidefari/gbfm/commit/d9a2be543d3944cfc17d2f1c689972b14dbd0b0c))

## [0.30.1](https://github.com/guidefari/gbfm/compare/v0.30.0...v0.30.1) (2025-10-09)

### Bug Fixes

- add links to spotify components ([cf3ef23](https://github.com/guidefari/gbfm/commit/cf3ef2338719f12de83611bc101b02bce8956a07))

# [0.30.0](https://github.com/guidefari/gbfm/compare/v0.29.0...v0.30.0) (2025-10-09)

### Bug Fixes

- bring back spotify ([fca9856](https://github.com/guidefari/gbfm/commit/fca9856efe951b29474b9e5918c96941f01192f3))
- build ([4e45eba](https://github.com/guidefari/gbfm/commit/4e45eba9dee4d68cf84e815bf2612b5bd77df969))

### Features

- labels. lowkey (highkey) wip tho. ([391ab61](https://github.com/guidefari/gbfm/commit/391ab61e216c06c9f327210843ac49c331a2b94b))
- raycast wip ([4ad7007](https://github.com/guidefari/gbfm/commit/4ad7007a7089d1e9a887db759283b8c9edb63188))

# [0.29.0](https://github.com/guidefari/gbfm/compare/v0.28.4...v0.29.0) (2025-10-07)

### Features

- theming updates ([4ff6944](https://github.com/guidefari/gbfm/commit/4ff6944153f98cf8a64665c028fa4e2bb9f7a4d5))

## [0.28.4](https://github.com/guidefari/gbfm/compare/v0.28.3...v0.28.4) (2025-10-06)

### Bug Fixes

- dockerfile ([96b8a37](https://github.com/guidefari/gbfm/commit/96b8a3762a47e001a7ab79197c5614b6e5ada576))

## [0.28.3](https://github.com/guidefari/gbfm/compare/v0.28.2...v0.28.3) (2025-10-06)

### Bug Fixes

- remove redundant typecheck ([55e081c](https://github.com/guidefari/gbfm/commit/55e081c05eb1239a3cc86ee070383c604c046f33))

## [0.28.2](https://github.com/guidefari/gbfm/compare/v0.28.1...v0.28.2) (2025-10-06)

### Bug Fixes

- dockerfile ([c084277](https://github.com/guidefari/gbfm/commit/c084277b96d9d2eddbb2e136ada4df15023bcebf))

## [0.28.1](https://github.com/guidefari/gbfm/compare/v0.28.0...v0.28.1) (2025-10-06)

### Bug Fixes

- dockerfile ([40f77be](https://github.com/guidefari/gbfm/commit/40f77be5f26d2fb05b0f27ab5f73a067cdf6fd63))

# [0.28.0](https://github.com/guidefari/gbfm/compare/v0.27.1...v0.28.0) (2025-10-06)

### Bug Fixes

- web build script ([fd6a502](https://github.com/guidefari/gbfm/commit/fd6a502662614b0a823a87bceb71f42ef3f6e459))

### Features

- fe types ([2fb9d01](https://github.com/guidefari/gbfm/commit/2fb9d011c7bd7c81fefb93056e90db094adddc52))

## [0.27.1](https://github.com/guidefari/gbfm/compare/v0.27.0...v0.27.1) (2025-10-06)

### Bug Fixes

- vps type fixes ([23cae93](https://github.com/guidefari/gbfm/commit/23cae932408eab4a138aefc4fa65a003bf49bfe3))

# [0.27.0](https://github.com/guidefari/gbfm/compare/v0.26.0...v0.27.0) (2025-09-28)

### Features

- cms wip ([df8a83e](https://github.com/guidefari/gbfm/commit/df8a83e29d19761ca353a5e411dec65cb9d8743d))

# [0.26.0](https://github.com/guidefari/gbfm/compare/v0.25.1...v0.26.0) (2025-09-24)

### Features

- content endpoints ([4731b9c](https://github.com/guidefari/gbfm/commit/4731b9cd72928ba2b2935cf70da8e34fe77a50f2))

## [0.25.1](https://github.com/guidefari/gbfm/compare/v0.25.0...v0.25.1) (2025-09-14)

### Bug Fixes

- missing secret ([79e047a](https://github.com/guidefari/gbfm/commit/79e047aae66ceb7104068455b409a0158e747f24))

# [0.25.0](https://github.com/guidefari/gbfm/compare/v0.24.0...v0.25.0) (2025-09-14)

### Features

- db migration ([2172a12](https://github.com/guidefari/gbfm/commit/2172a12867fd97962915399eebc9ad666b1dc5f7))
- db migration cont ([7663fdc](https://github.com/guidefari/gbfm/commit/7663fdcbb7979f1e20384bbad1ea65332f05be10))

# [0.24.0](https://github.com/guidefari/gbfm/compare/v0.23.0...v0.24.0) (2025-08-09)

### Features

- audio player + keyboard shortcuts ([5abc7bc](https://github.com/guidefari/gbfm/commit/5abc7bc40accfd25303f2587ebcc5837cf4cf1c1))

# [0.23.0](https://github.com/guidefari/gbfm/compare/v0.22.0...v0.23.0) (2025-08-08)

### Features

- fullscreen audio player ([d8a1fd0](https://github.com/guidefari/gbfm/commit/d8a1fd07a63de1de8e9795dce2adc428f6100363))

# [0.22.0](https://github.com/guidefari/gbfm/compare/v0.21.0...v0.22.0) (2025-08-07)

### Features

- queue ([314b2e6](https://github.com/guidefari/gbfm/commit/314b2e6db9ba4bf7e70d3cd58fa2d5951ba352ec))
- refreshed audio player ([38acf73](https://github.com/guidefari/gbfm/commit/38acf7319a85bea45946ccf3f5622c081dc4eb85))

# [0.21.0](https://github.com/guidefari/gbfm/compare/v0.20.2...v0.21.0) (2025-08-06)

### Features

- upload audio ([8066e35](https://github.com/guidefari/gbfm/commit/8066e35f9f8db0d37debf78e17081b58ab399883))

## [0.20.2](https://github.com/guidefari/gbfm/compare/v0.20.1...v0.20.2) (2025-08-05)

### Bug Fixes

- web build script ([f43c60a](https://github.com/guidefari/gbfm/commit/f43c60a2088f30f543ec6a721c959f5e8abb9643))

## [0.20.1](https://github.com/guidefari/gbfm/compare/v0.20.0...v0.20.1) (2025-08-05)

### Bug Fixes

- deploy script ([4e11b32](https://github.com/guidefari/gbfm/commit/4e11b32d7108aabb898a8c95207336e5aaa9f7a3))

# [0.20.0](https://github.com/guidefari/gbfm/compare/v0.19.1...v0.20.0) (2025-08-05)

### Features

- volume controls ([da32fc0](https://github.com/guidefari/gbfm/commit/da32fc08f5021290f7ab805b89b61f217abf8114))

## [0.19.1](https://github.com/guidefari/gbfm/compare/v0.19.0...v0.19.1) (2025-08-05)

### Bug Fixes

- docker entrypoint ([56d3f2b](https://github.com/guidefari/gbfm/commit/56d3f2ba12c9fe39dd07af1183f1eeaf3e52f2dd))

# [0.19.0](https://github.com/guidefari/gbfm/compare/v0.18.0...v0.19.0) (2025-08-05)

### Bug Fixes

- dockerfile ([2a06d02](https://github.com/guidefari/gbfm/commit/2a06d02842177c9bd6146b1ca4f9f6ce2ff91732))

### Features

- loading skeleton ([b7c548f](https://github.com/guidefari/gbfm/commit/b7c548fa78e61faceba4718e2d723e7d24aaa964))

# [0.18.0](https://github.com/guidefari/gbfm/compare/v0.17.0...v0.18.0) (2025-08-05)

### Features

- audio player improvements ([5577abe](https://github.com/guidefari/gbfm/commit/5577abed16e359f3ebe5e23e50b49cfb731dff8e))

# [0.17.0](https://github.com/guidefari/gbfm/compare/v0.16.0...v0.17.0) (2025-08-03)

### Bug Fixes

- grid on single mix page was wonky ([aeb46e8](https://github.com/guidefari/gbfm/commit/aeb46e847ed298a0fda603f4ff4127d1c2e75ae5))
- remove redundant frontmatter processing ([103b086](https://github.com/guidefari/gbfm/commit/103b0868629a4ec4586fe04e8851f4e2fbff62b7))

### Features

- single mix page ([0d23491](https://github.com/guidefari/gbfm/commit/0d23491731de4a9a25202a807681391d801cb47e))

# [0.16.0](https://github.com/guidefari/gbfm/compare/v0.15.0...v0.16.0) (2025-08-01)

### Features

- commando updates ([0841bd3](https://github.com/guidefari/gbfm/commit/0841bd31e5ae6e6d22412afa4a50ecb992f6ddef))

# [0.15.0](https://github.com/guidefari/gbfm/compare/v0.14.0...v0.15.0) (2025-07-27)

### Features

- dynamic rss ([de26bb6](https://github.com/guidefari/gbfm/commit/de26bb66f19859326992058d2828a997a3804cfc))
- file upload endpoints ([fcc59a6](https://github.com/guidefari/gbfm/commit/fcc59a69921e903c019565ac10a489d825ccbb50))
- upload audio ui ([485cb92](https://github.com/guidefari/gbfm/commit/485cb9240535fbb412d8be9c9f2d524927750c1e))

# [0.14.0](https://github.com/guidefari/gbfm/compare/v0.13.0...v0.14.0) (2025-07-26)

### Features

- remove web workers. ([5689fed](https://github.com/guidefari/gbfm/commit/5689fed7bc25cdd86957ae660aa4c506a8256265))

# [0.13.0](https://github.com/guidefari/gbfm/compare/v0.12.0...v0.13.0) (2025-07-26)

### Features

- update profile ([fad00e6](https://github.com/guidefari/gbfm/commit/fad00e6ccc516793c758d27074edc91540de7f45))

# [0.12.0](https://github.com/guidefari/gbfm/compare/v0.11.0...v0.12.0) (2025-07-26)

### Bug Fixes

- type errors ([88bcac9](https://github.com/guidefari/gbfm/commit/88bcac941e01fb3c2495123a652fe4b2fd9bde8f))

### Features

- auth & profile stuff ([e7e1490](https://github.com/guidefari/gbfm/commit/e7e1490009b66bf7f7d6442229fc61a8eba364d2))

# [0.11.0](https://github.com/guidefari/gbfm/compare/v0.10.4...v0.11.0) (2025-07-26)

### Features

- update mix route ([9acbbc0](https://github.com/guidefari/gbfm/commit/9acbbc0a0562ada6d0147025c18e51d05d6ca677))

## [0.10.4](https://github.com/guidefari/gbfm/compare/v0.10.3...v0.10.4) (2025-07-25)

### Bug Fixes

- add pnpm workspace file to container ([92e5034](https://github.com/guidefari/gbfm/commit/92e503459881f160b2a7b61c67b1a092ab7b45c0))

## [0.10.3](https://github.com/guidefari/gbfm/compare/v0.10.2...v0.10.3) (2025-07-25)

### Bug Fixes

- www build script ([12e2b41](https://github.com/guidefari/gbfm/commit/12e2b41b94417063fdc1957e9b166ecc03acad67))

## [0.10.2](https://github.com/guidefari/gbfm/compare/v0.10.1...v0.10.2) (2025-07-25)

### Bug Fixes

- www build script ([1585e92](https://github.com/guidefari/gbfm/commit/1585e92d07ff427fc48b1a4f3855c3933706f88b))

## [0.10.1](https://github.com/guidefari/gbfm/compare/v0.10.0...v0.10.1) (2025-07-25)

### Bug Fixes

- dockerfile paths ([ac2ce8e](https://github.com/guidefari/gbfm/commit/ac2ce8e608269db90fda3b114b69ae343946a68e))

# [0.10.0](https://github.com/guidefari/gbfm/compare/v0.9.0...v0.10.0) (2025-07-25)

### Features

- content migration scripts ([b5881b2](https://github.com/guidefari/gbfm/commit/b5881b2c6c21f592c6e77c0286567c8df12980f4))

# [0.9.0](https://github.com/guidefari/gbfm/compare/v0.8.0...v0.9.0) (2025-07-25)

### Features

- migrating from mixes schema to generic audio ([c5335f0](https://github.com/guidefari/gbfm/commit/c5335f04fd78b6eddb094851f29bc926a4dfa217))

# [0.8.0](https://github.com/guidefari/gbfm/compare/v0.7.0...v0.8.0) (2025-07-23)

### Features

- release test ([d3fb620](https://github.com/guidefari/gbfm/commit/d3fb6209591b1737cfa2d29278cd551b038b5cee))

# [0.7.0](https://github.com/guidefari/gbfm/compare/v0.6.5...v0.7.0) (2025-07-23)

### Bug Fixes

- update seed scripts ([bfe3835](https://github.com/guidefari/gbfm/commit/bfe38358176fd97b590d966ceec0fc1fa4bce4b8))

### Features

- disable seed endpoint ([5bc992e](https://github.com/guidefari/gbfm/commit/5bc992efb30cd133ab098fb789012c0421f59984))

## [0.6.5](https://github.com/guidefari/gbfm/compare/v0.6.4...v0.6.5) (2025-07-22)

### Bug Fixes

- import path ([0b1b641](https://github.com/guidefari/gbfm/commit/0b1b6413969ea32cefeaa4be901eb6a0d717d485))
- type errors - #blind fix👀 ([0248c02](https://github.com/guidefari/gbfm/commit/0248c02e7a782247b88d15191af1407a659ddcbd))
