# Plan: Go Backend Clone of VPS App

## Architecture Decision

**Sidecar Pattern**: TypeScript VPS handles auth (`/auth/*`), Go handles everything else.

- **Shared PostgreSQL database** - both services read/write same tables
- **Shared sessions** - Go validates session tokens directly against `session` table
- **Same ECS cluster** - deploy alongside existing VPS service

---

## Routes for Go Backend (~50 endpoints)

### Excluded (Stay in TypeScript VPS)

- `/auth/*` - better-auth routes (sign-up, sign-in, sign-out, verification)

### Included in Go

| Route Group                              | Endpoints | Key Features                                       |
| ---------------------------------------- | --------- | -------------------------------------------------- |
| **Content** (`/content`)                 | 12        | Audio CRUD, mixes, posts, labels, releases, QR PDF |
| **User** (`/user`)                       | 5         | Profile, email preferences, subscriptions, search  |
| **Profile** (`/profile`)                 | 1         | Public profile with user content                   |
| **Favorites** (`/favorites`)             | 3         | Add/list/remove favorites                          |
| **Shows** (`/shows`)                     | 7         | CRUD, episodes, subscriptions                      |
| **Music Reminders** (`/music-reminders`) | 4         | Reminder CRUD with rate limiting                   |
| **Spotify** (`/spotify`)                 | 5         | Track/album/playlist metadata, search, enrichment  |
| **Resolve** (`/resolve`)                 | 1         | Slug resolution                                    |
| **Newsletter** (`/newsletter`)           | 1         | Subscribe                                          |
| **Email** (`/email`)                     | 1         | Send mix notifications                             |
| **Publication** (`/publication`)         | 5         | CRUD                                               |
| **Upload** (`/upload`)                   | 1         | File upload (audio/images)                         |
| **Share/SEO** (`/s/*`, root)             | 9         | Share links, robots.txt, sitemap.xml               |
| **RSS** (`/rss.xml`)                     | 1         | Feed generation                                    |
| **Health** (`/health`)                   | 1         | DB connectivity check                              |

### Background Services (in Go)

1. **Reminder Processor** - 30s interval
2. **QR Cache Cleanup** - 15min interval
3. **Sitemap Regeneration** - 1hr interval

---

## Session Validation in Go

The Go service validates sessions by querying the `session` table directly:

```go
// Middleware pseudocode
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractBearerToken(r) // or cookie

        // Query session table
        session, user := db.Query(`
            SELECT s.*, u.* FROM session s
            JOIN "user" u ON s.user_id = u.id
            WHERE s.token = $1 AND s.expires_at > NOW()
        `, token)

        if session == nil {
            http.Error(w, "Unauthorized", 401)
            return
        }

        ctx := context.WithValue(r.Context(), "user", user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Session table schema** (from `auth.schema.ts`):

- `id` (text, PK)
- `token` (text, unique) - used for validation
- `expires_at` (timestamp) - must be > NOW()
- `user_id` (text, FK → user)
- `ip_address`, `user_agent` - for logging

---

## Data Models (from `apps/vps/src/db/`)

### Core Tables

```
user              - id, name, email, image, username, bio, roles, banned
session           - id, user_id, token, expires_at, ip_address, user_agent
account           - id, user_id, provider, account_id, credentials
verification      - id, identifier, value, expires_at

audio             - id, title, slug, description, type (mix/track/misc), urls,
                    thumbnail, show_id, episode_number, tags, content, draft
audio_creators    - audio_id, user_id (many-to-many)

show              - id, title, slug, description, thumbnail, content, draft
show_creators     - show_id, user_id
show_subscriptions - user_id, show_id

post              - id, title, slug, type (post/micro), publication_id, content
post_creators     - post_id, user_id

label             - id, name, slug, description, website, discogs_url,
                    bandcamp_url, genres, thumbnail

release           - id, title, slug, label_id, description, release_date,
                    streaming_links (JSONB), thumbnail

favorites         - id, user_id, audio_id OR show_id (exclusive)

music_reminder    - id, user_id, album_name, artist_name, release_date,
                    spotify_url, status (pending/processing/sent/failed),
                    album_artwork, reminder_date

publication       - id, name, slug, description
publication_members - publication_id, user_id

email_delivery_log - id, recipient, subject, status, sent_at
email_preferences  - user_id, transactional, mix_release, promotional, system

newsletter_subscriber - id, email, confirmed_at
```

### Common Field Patterns

- UUIDs for primary keys
- `slug` for URL-friendly identifiers
- `created_at`, `updated_at` timestamps
- `draft` boolean for unpublished content
- `tags` as text arrays
- `content` for MDX body text

---

## Proposed Go Backend Structure

```
apps/go-api/
├── main.go                 # Entry point
├── go.mod
├── go.sum
├── Dockerfile
├── package.json            # Minimal, for SST workspace
├── cmd/
│   └── api/
│       └── main.go
├── internal/
│   ├── config/             # Environment/SST config loading
│   ├── database/           # PostgreSQL connection, migrations
│   ├── middleware/         # Auth, rate limiting, CORS, logging
│   ├── models/             # Database models (matching Drizzle schemas)
│   ├── handlers/           # HTTP handlers by domain
│   │   ├── content/
│   │   ├── user/
│   │   ├── auth/
│   │   ├── shows/
│   │   ├── favorites/
│   │   ├── spotify/
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── spotify/
│   │   ├── bandcamp/
│   │   ├── s3/
│   │   ├── email/
│   │   └── reminder/
│   └── jobs/               # Background workers
│       ├── reminder_processor.go
│       ├── qr_cleanup.go
│       └── sitemap.go
└── migrations/             # SQL migrations (can share with VPS)
```

### Recommended Go Libraries

| Purpose       | Library                    | Notes                                |
| ------------- | -------------------------- | ------------------------------------ |
| HTTP Router   | `chi` or `echo`            | Lightweight, middleware-friendly     |
| Database      | `sqlc` + `pgx`             | Type-safe queries, native PostgreSQL |
| Migrations    | `goose`                    | SQL-based migrations                 |
| Validation    | `go-playground/validator`  | Struct tag validation                |
| Config        | `envconfig` or `viper`     | Environment variable parsing         |
| Logging       | `slog` (stdlib)            | Structured logging                   |
| S3            | `aws-sdk-go-v2`            | AWS S3 operations                    |
| Spotify       | Custom HTTP client         | No official Go SDK                   |
| OpenTelemetry | `go.opentelemetry.io/otel` | Tracing/metrics                      |

---

## SST Integration

### Infrastructure File: `infra/go-api.ts`

```typescript
export const goApi = new sst.aws.Service('gbfm_go_api', {
  cluster,
  image: {
    context: './',
    target: 'release',
    dockerfile: 'apps/go-api/Dockerfile'
  },
  dev: {
    directory: './apps/go-api',
    command: 'go run ./cmd/api'
  },
  link: [
    vpsPostgres, // Same database
    urls,
    fileRouter,
    contentBucket,
    spotifyClientId,
    spotifyClientSecret
    // ... other secrets
  ],
  capacity: 'spot'
})
```

### Shared Resources

- **Same PostgreSQL database** as VPS
- **Same S3 buckets** for content
- **Same secrets** via SST linking

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│ API Gateway (vps.goosebumps.fm)                        │
├─────────────────────────────────────────────────────────┤
│  /auth/*  → TypeScript VPS (port 3003)                 │
│  /*       → Go API (port 8080)                         │
└─────────────────────────────────────────────────────────┘
              │                    │
              ▼                    ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ TS VPS Service  │   │  Go API Service │
    │ (better-auth)   │   │  (all routes)   │
    └────────┬────────┘   └────────┬────────┘
             │                     │
             └──────────┬──────────┘
                        ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │ (shared tables) │
              └─────────────────┘
```

**Option A**: Single API Gateway with path-based routing
**Option B**: Two separate gateways (go-api.goosebumps.fm)

---

## Implementation Plan

### Phase 1: Project Setup

1. Create `apps/go-api/` directory
2. Initialize Go module (`go mod init github.com/guidefari/gbfm/apps/go-api`)
3. Create Dockerfile (multi-stage build)
4. Add minimal `package.json` for SST workspace
5. Create `infra/go-api.ts` with ECS service definition

### Phase 2: Core Infrastructure

1. Database connection with `pgx`
2. Config loading from SST environment variables
3. HTTP router setup (`chi` or `echo`)
4. Session validation middleware
5. Rate limiting middleware
6. CORS middleware
7. Request ID/logging middleware
8. Health check endpoint

### Phase 3: Models & Database Layer

1. Generate Go structs from Drizzle schemas (or write manually)
2. Set up `sqlc` for type-safe queries
3. Create repository layer for each domain

### Phase 4: Route Implementation (by domain)

1. `/content` - Audio, posts, labels, releases
2. `/user` - Profile, preferences, subscriptions
3. `/favorites` - CRUD
4. `/shows` - CRUD, episodes, subscriptions
5. `/spotify` - External API integration
6. `/music-reminders` - CRUD
7. `/upload` - S3 file handling
8. `/publication` - CRUD
9. `/newsletter`, `/email`, `/resolve`
10. `/s/*`, `/rss.xml`, `/robots.txt`, `/sitemap.xml`

### Phase 5: Background Services

1. Reminder processor (30s ticker)
2. QR cache cleanup (15m ticker)
3. Sitemap regeneration (1hr ticker)

### Phase 6: Testing & Deployment

1. Integration tests against test database
2. Deploy to ECS cluster
3. Configure API Gateway routing
4. Gradual traffic migration

---

## Key Files to Reference

| Purpose                | Path                                                 |
| ---------------------- | ---------------------------------------------------- |
| **Database schemas**   | `apps/vps/src/db/*.schema.ts`                        |
| **Route definitions**  | `apps/vps/src/routes/*/`                             |
| **Service logic**      | `apps/vps/src/services/`                             |
| **Auth middleware**    | `apps/vps/src/middlewares/better-auth.middleware.ts` |
| **Infrastructure**     | `infra/vps.ts`                                       |
| **Secrets**            | `infra/secret.ts`                                    |
| **Dockerfile example** | `apps/vps/Dockerfile`                                |

---

## Files to Create

```
apps/go-api/
├── main.go
├── go.mod
├── go.sum
├── Dockerfile
├── package.json
├── sqlc.yaml
├── internal/
│   ├── config/config.go
│   ├── database/
│   │   ├── db.go
│   │   └── queries/           # sqlc generated
│   ├── middleware/
│   │   ├── auth.go
│   │   ├── cors.go
│   │   ├── ratelimit.go
│   │   └── logging.go
│   ├── handlers/
│   │   ├── content.go
│   │   ├── user.go
│   │   ├── shows.go
│   │   ├── favorites.go
│   │   ├── spotify.go
│   │   └── ...
│   ├── services/
│   │   ├── spotify/
│   │   ├── bandcamp/
│   │   ├── s3/
│   │   └── email/
│   └── jobs/
│       ├── reminder.go
│       ├── qr_cleanup.go
│       └── sitemap.go
└── sql/
    └── queries.sql            # sqlc input
```

```
infra/go-api.ts                # SST service definition
```

---

## Verification

1. Run `go build` to verify compilation
2. Run `go test ./...` for unit tests
3. Start local server with `go run main.go`
4. Test endpoints against local PostgreSQL
5. Deploy to dev stage with `bun deploy`
6. Verify API Gateway routing
7. Run integration tests against deployed service
