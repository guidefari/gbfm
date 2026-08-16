# Open music metadata sources for GBFM

Date: 2026-08-16

## Decision summary

GBFM should use MusicBrainz as an optional identity and metadata authority for artists, albums, and tracks, behind the provider-aware resolver described in the music resolution issues. It should not use MusicBrainz as another broad link scraper.

The recommended roles are:

- MusicBrainz: canonical open identifiers and evidence for cross-platform reconciliation.
- Cover Art Archive: optional release artwork fallback, with explicit copyright caution.
- Wikidata: optional artist-level identifiers and factual enrichment, not primary music matching.
- ListenBrainz: future popularity and recommendation signals, not catalog identity.
- AcoustID: future audio-fingerprint identification only when GBFM has an audio file or fingerprint.
- Discogs: exclude from the initial integration because its mixed data terms, six-hour freshness rule, and restrictions on commercial use and transfer are a poor fit for durable entity records.

Odesli, Spotify, and Deezer retain their proposed roles. Odesli discovers service links; Spotify and Deezer resolve exact source URLs and supply service metadata; MusicBrainz helps decide whether independently discovered artist, album, and track records refer to the same musical entity.

Playlists are an invariant exception: a playlist is exact to its source platform. GBFM must not send playlists to MusicBrainz, Odesli, Wikidata, or any text/identifier matcher to infer an equivalent playlist on another platform.

## Why MusicBrainz fits

MusicBrainz models stable entities that align well with GBFM:

| GBFM entity | MusicBrainz identity | Use |
| --- | --- | --- |
| Artist | Artist MBID | Canonical artist identity and disambiguation |
| Album | Release-group MBID | Platform-neutral album concept |
| Album edition/source | Release MBID | Edition-specific date, country, barcode, track list, external URLs, and artwork |
| Track | Recording MBID | Identity for a distinct recording, with ISRC links |
| Playlist | None | Do not match across platforms |

MusicBrainz distinguishes a release group, the general album concept, from a release, a specific edition or issuing. That distinction lets GBFM keep one album entity while retaining edition evidence in link metadata. A MusicBrainz recording represents distinct audio and can carry one or more ISRCs. An ISRC identifies a recording rather than the underlying composition, so it is strong evidence but does not prove that two different masters, edits, remixes, or live versions are interchangeable. Sources: [release groups](https://musicbrainz.org/doc/Release_Group), [releases](https://musicbrainz.org/doc/Release), [recordings](https://musicbrainz.org/doc/Recording), and [ISRC semantics](https://musicbrainz.org/doc/ISRC).

The API supports lookups by MBID and ISRC, recording searches with an `isrc` field, and URL relationships. MusicBrainz guidelines require external URLs to match the exact entity and edition, which makes those relationships useful as corroborating evidence for Spotify, Deezer, and Discogs URLs. Sources: [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), [search API](https://musicbrainz.org/doc/MusicBrainz_API/Search), and [URL relationship guidelines](https://musicbrainz.org/doc/Style/Relationships/URLs).

MBIDs are intended as permanent identifiers, but duplicate entities can be merged and an old MBID can redirect to the surviving canonical MBID. GBFM should follow redirects and update stored canonical identity while retaining the old identifier in provenance. Source: [MusicBrainz Identifier](https://musicbrainz.org/doc/MusicBrainz_Identifier).

## Licensing and operating constraints

### MusicBrainz

The core MusicBrainz database is CC0 and may be used without commercial restrictions. Supplementary data is CC BY-NC-SA 3.0. The downloadable `mbdump.tar.bz2` core catalog is CC0, while derived data, statistics, edit history, and Cover Art Archive metadata dumps are BY-NC-SA. The live replication feed is also BY-NC-SA. GBFM should persist only the core fields needed for identity unless it deliberately accepts the supplementary-data obligations. Sources: [MusicBrainz data license](https://musicbrainz.org/doc/About/Data_License) and [dump contents and licenses](https://musicbrainz.org/doc/MusicBrainz_Database/Download).

The public MusicBrainz web service is free for non-commercial use. MusicBrainz directs commercial users to a commercial plan or direct contact. Even if GBFM currently operates as a nonprofit or non-commercial project, this service-level condition is separate from the CC0 license on core data. Before any commercial use, GBFM should obtain written confirmation or a suitable MetaBrainz plan, or operate from the CC0 core dump instead. Source: [MusicBrainz API terms and access rules](https://musicbrainz.org/doc/MusicBrainz_API).

The public API requires a meaningful contactable `User-Agent` and an application must stay at or below one request per second per source IP unless separately agreed. It can return 503 when application, IP, or global limits are hit. MusicBrainz advises against polling for changes. GBFM should use one process-wide rate limiter, bounded retries with jitter for 503, durable positive caching by MBID/ISRC, and negative caching for ambiguous or missing results. Sources: [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) and [rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting).

At larger scale, MetaBrainz also publishes CC0 canonical release/recording mappings and searchable normalized metadata twice monthly. This could support local candidate generation, but canonical MBIDs can change following merges. It is a later operational option, not necessary for the first provider integration. Source: [Canonical MusicBrainz data](https://musicbrainz.org/doc/Canonical_MusicBrainz_data).

### Cover Art Archive

The Cover Art Archive is operated by the Internet Archive and curated by the MusicBrainz community. Its API indexes images by release MBID and identifies front/back images and approved status. Its API documentation currently says there are no fixed rate-limit rules, but the endpoint documents 503 as a possible response. Sources: [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive) and [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API).

The images themselves are not granted a blanket Creative Commons license. MusicBrainz says cover art carries legal and copyright issues and that images are available for archival purposes, at the user's risk. Therefore GBFM should treat Cover Art Archive URLs as a fallback display source, not copy images into its own storage by default, retain the release MBID and Archive source URL, provide attribution, and support removal/replacement. Approved status is a curation signal, not a copyright license. Sources: [Cover Art Archive policy](https://musicbrainz.org/doc/Cover_Art_Archive) and [MusicBrainz cover-art guidance](https://musicbrainz.org/doc/Cover_Art).

### Wikidata

Wikidata's structured entity data is CC0. Attribution is not legally required for CC0 data, but Wikidata asks reusers to credit it and provide a way to report data errors. It offers entity JSON, Action API, query service, and dumps. Clients should identify themselves, avoid excessive concurrency, respect `429` and `Retry-After`, and use dumps for large result sets. Sources: [Wikidata data access and reuse guidance](https://www.wikidata.org/wiki/Help:Data_access) and [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing).

Wikidata is useful after an artist has a MusicBrainz or Wikidata identifier, for official websites, country, and other identifiers. Its broad search should not decide track or album equivalence. Images linked from Wikidata or Wikimedia Commons have per-file licenses and must be checked individually, so GBFM must not infer that a Wikidata image is CC0.

### ListenBrainz

ListenBrainz makes public listen data and user text available under CC0. Its API exposes listening, popularity, statistics, recommendation, metadata, and art endpoints. Rate limits are dynamic and communicated through response headers; a client must follow the remaining/reset headers and stop on 429. Authenticated requests may receive higher limits. Sources: [ListenBrainz terms](https://listenbrainz.org/terms-of-service/) and [ListenBrainz API and rate limits](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html).

ListenBrainz can return MBID mappings resolved from submitted metadata, but those mappings are downstream MusicBrainz matching results rather than a better catalog authority. It is a future source for popularity and discovery, after GBFM already holds a recording MBID. It should not participate in entity creation or cross-platform identity decisions. Source: [ListenBrainz JSON format](https://listenbrainz.readthedocs.io/en/latest/users/json.html).

### AcoustID

AcoustID maps audio fingerprints to MusicBrainz recording identifiers. Its database is CC BY-SA 3.0; the free hosted web service prohibits commercial use, requires an application key, limits clients to three requests per second, and asks high-traffic applications to coordinate in advance. Sources: [AcoustID license](https://acoustid.org/license) and [AcoustID web service rules](https://acoustid.org/webservice).

This is valuable only when GBFM possesses audio that it is permitted to fingerprint. It does not help resolve a pasted Spotify or Deezer URL by itself. Keep it out of the first implementation and revisit it for uploaded mixes or artist-submitted audio, with attribution and share-alike implications reviewed first.

### Discogs

Discogs API content includes both CC0 and restricted data. Restricted data is revocably licensed, cannot be used commercially or transferred, must not be displayed when more than six hours stale, and cannot be cached longer than needed to serve users. Discogs also requires attribution with a link to the corresponding Discogs page. These rules conflict with GBFM's durable entity and link records unless the integration isolates provably CC0 fields and refreshes or deletes restricted content correctly. Source: [Discogs API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use).

The initial resolver should therefore omit Discogs. A later, separately reviewed feature could store a user-provided Discogs URL as a link without importing Discogs API metadata.

## Recommended resolution policy

For artists, albums, and tracks:

1. Resolve the submitted Spotify or Deezer URL exactly through its source API.
2. Preserve its source platform ID and identifiers such as ISRC.
3. Ask Odesli for cross-platform links.
4. Query MusicBrainz in descending confidence order:
   - existing MBID;
   - exact external URL relationship;
   - exact normalized ISRC for a track;
   - conservative metadata candidate search.
5. Accept an automatic MusicBrainz match only when strong identifiers agree. Metadata search should produce candidates, not silently select the first result.
6. Store the MusicBrainz URL as a normal entity link and store provenance, MBID type, confidence, matched identifiers, and lookup time in the link metadata. Follow MBID redirects during refresh and canonicalize the stored identity.
7. Use MusicBrainz to validate or fill identity fields. Do not let a weak MusicBrainz search overwrite exact source-platform metadata.
8. For albums, attach a release-group MBID to the GBFM album identity and retain any edition-specific release MBID in provenance metadata. Use the release MBID for Cover Art Archive lookup.

For playlists, stop after exact source resolution and persistence. Do not execute steps 3 through 8.

## Fit with the current code

The current `MusicBrainzProvider` in `apps/server/src/services/music-link-scraper.service.ts` searches the recording endpoint with artist/title/release text and takes the first result. That is unsafe for automatic identity because it has no confidence threshold and treats albums as recording queries. It also lives behind a generic `fetchLinks` interface even though MusicBrainz is primarily an identity provider.

The safer incremental change is:

- Keep the public API contracts unchanged initially.
- Replace the current MusicBrainz provider with a capability-specific identity adapter for artist, release group/release, and recording lookup.
- Never invoke that adapter for `playlist`.
- Add a single shared MusicBrainz rate limiter for the whole server runtime, not one limiter per request.
- Preserve the existing `musicbrainz` platform link and store MBIDs and match provenance in the existing link `metadata` JSON, avoiding a schema migration.
- Make exact URL and ISRC lookup automatic, but return metadata-search ambiguity to the resolver as an unresolved candidate set.
- Add Cover Art Archive only as an album-art fallback after a release MBID is known.
- Add a visible attribution page or footer entry naming MusicBrainz, Cover Art Archive/Internet Archive, Wikidata, ListenBrainz, or AcoustID whenever GBFM uses data from those sources.

This isolates licensing and identity decisions from Odesli link fan-out and source-platform retrieval. It also leaves a clear path to a future normalized external-identifier table if the metadata JSON becomes difficult to query.

## Proposed GitHub issue

Title: `Add MusicBrainz identity enrichment with open-data provenance`

Scope:

- Replace first-result MusicBrainz text matching with typed artist, release-group/release, and recording lookups.
- Match by existing MBID, exact MusicBrainz URL relationship, or exact ISRC before metadata search.
- Treat metadata search as candidate generation with a conservative acceptance policy.
- Persist MusicBrainz links and provenance in existing entity-link metadata.
- Enforce the playlist invariant: no MusicBrainz, Odesli fan-out, or cross-platform matching for playlists.
- Add a runtime-wide one-request-per-second limiter, contactable `User-Agent`, retry/backoff, and positive/negative caching.
- Add optional Cover Art Archive fallback only when a release MBID is known, without copying artwork by default.
- Add source attribution in the product.
- Document that commercial deployment requires a MetaBrainz service agreement or a separately designed CC0-dump ingestion path.

Acceptance criteria:

- Exact ISRC and exact external-URL matches can attach the correct recording/release/artist MBID.
- Ambiguous text searches do not create or merge an entity automatically.
- Albums distinguish release-group identity from edition-specific release evidence.
- Playlists make no requests to MusicBrainz, Cover Art Archive, Wikidata, ListenBrainz, or AcoustID.
- MusicBrainz traffic never exceeds one request per second per runtime egress IP and sends the required `User-Agent`.
- Provider outages leave an entity partially enriched rather than invalidating an exact Spotify or Deezer source resolution.
- Stored metadata records source, identifier type, confidence, and lookup timestamp.
- Refresh follows MusicBrainz identifier redirects without losing prior provenance.
- Artwork fallback records its source and does not imply that approval grants reuse rights.
- Attribution and commercial-use constraints are documented and visible to operators.

Out of scope:

- MusicBrainz database dump hosting or replication.
- ListenBrainz recommendations or popularity features.
- AcoustID fingerprint generation.
- Discogs API metadata ingestion.
- Cross-platform playlist matching.
