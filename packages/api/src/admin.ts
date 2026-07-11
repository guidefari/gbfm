import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

// effect@4.0.0-beta.93's HttpApiError has no built-in 429 -- the frontend
// error simulator (QA tool exercising www's error boundary/Sentry-reporting
// threshold against every real status code, apps/www/src/routes/admin/
// frontend-errors.tsx) needs one, so it's declared here the same way Phase 2
// of the migration doc ports any other domain error. www only reads the
// response status (http-client.ts's res.status >= 500 gate) and falls back
// to statusText for the message, not the JSON body, so this (and the other
// scenarios below) don't need to preserve the old Hono handler's
// { error, scenario } response body -- the built-in HttpApiError classes'
// empty-body responses are equivalent from www's point of view.
export class SimulatedRateLimitError extends Schema.TaggedErrorClass<SimulatedRateLimitError>()(
  'SimulatedRateLimitError',
  {},
  { httpApiStatus: 429 }
) {}

// Mirrors apps/vps/src/db/admin-overview.schema.ts (Zod, DB-facing) --
// kept as its own leaf schema here since packages/api can't import from
// apps/vps.
const ContentBreakdown = Schema.Struct({
  published: Schema.Number,
  drafts: Schema.Number,
  newLast7Days: Schema.Number
})

const RecentContentItem = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  slug: Schema.String,
  type: Schema.Literals(['mix', 'track', 'misc', 'show', 'post', 'micro', 'label', 'release']),
  createdAt: Schema.String,
  draft: Schema.Boolean
})

const TopMix = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  playCount: Schema.Number,
  createdAt: Schema.String,
  creators: Schema.Array(Schema.String)
})

const RecentUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
  createdAt: Schema.String,
  emailVerified: Schema.Boolean
})

const RecentSubscriber = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  source: Schema.NullOr(Schema.String),
  createdAt: Schema.String
})

const RecentEmailFailure = Schema.Struct({
  id: Schema.String,
  recipientEmail: Schema.String,
  subject: Schema.String,
  status: Schema.String,
  createdAt: Schema.String,
  errorMessage: Schema.NullOr(Schema.String)
})

export const AdminOverviewResponse = Schema.Struct({
  generatedAt: Schema.String,
  highlights: Schema.Struct({
    totalUsers: Schema.Number,
    verifiedUsers: Schema.Number,
    newsletterSubscribers: Schema.Number,
    totalPlayCount: Schema.Number,
    publishedMixes: Schema.Number,
    newUsersLast7Days: Schema.Number,
    newSubscribersLast30Days: Schema.Number,
    newMixesLast30Days: Schema.Number
  }),
  publishing: Schema.Struct({
    mixes: ContentBreakdown,
    tracks: ContentBreakdown,
    miscAudio: ContentBreakdown,
    shows: ContentBreakdown,
    posts: ContentBreakdown,
    micros: ContentBreakdown,
    labels: ContentBreakdown,
    releases: ContentBreakdown,
    recentContent: Schema.Array(RecentContentItem),
    topMixes: Schema.Array(TopMix)
  }),
  community: Schema.Struct({
    users: Schema.Struct({
      total: Schema.Number,
      verified: Schema.Number,
      admins: Schema.Number,
      editors: Schema.Number,
      creators: Schema.Number,
      banned: Schema.Number,
      newLast7Days: Schema.Number,
      newLast30Days: Schema.Number
    }),
    sessions: Schema.Struct({
      active: Schema.Number
    }),
    newsletter: Schema.Struct({
      total: Schema.Number,
      newLast7Days: Schema.Number,
      newLast30Days: Schema.Number
    }),
    engagement: Schema.Struct({
      favoritesTotal: Schema.Number,
      showSubscriptionsTotal: Schema.Number
    }),
    recentUsers: Schema.Array(RecentUser),
    recentSubscribers: Schema.Array(RecentSubscriber)
  }),
  operations: Schema.Struct({
    emails: Schema.Struct({
      total: Schema.Number,
      sent: Schema.Number,
      delivered: Schema.Number,
      bounced: Schema.Number,
      complained: Schema.Number,
      failed: Schema.Number,
      pending: Schema.Number,
      failedLast7Days: Schema.Number,
      recentFailures: Schema.Array(RecentEmailFailure)
    }),
    reminders: Schema.Struct({
      pending: Schema.Number,
      processing: Schema.Number,
      failed: Schema.Number,
      dueNow: Schema.Number
    })
  })
})
export type AdminOverviewResponse = typeof AdminOverviewResponse.Type

const FrontendErrorScenario = Schema.Literals([
  'ok',
  'bad-request',
  'not-found',
  'rate-limit',
  'error',
  'unavailable'
])

export const FrontendErrorOkResponse = Schema.Struct({
  scenario: Schema.String,
  message: Schema.String
})

export const NewsletterSubscribersResponse = Schema.Struct({
  subscribers: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      email: Schema.String,
      name: Schema.NullOr(Schema.String),
      source: Schema.NullOr(Schema.String),
      unsubscribedAt: Schema.NullOr(Schema.String),
      createdAt: Schema.String
    })
  )
})

export const AdminGroup = HttpApiGroup.make('admin')
  .add(
    HttpApiEndpoint.get('getAdminOverview', '/api/admin/overview', {
      success: AdminOverviewResponse,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('simulateFrontendError', '/api/admin/frontend-errors/:scenario', {
      params: { scenario: FrontendErrorScenario },
      success: FrontendErrorOkResponse,
      error: [
        HttpApiError.Forbidden,
        HttpApiError.BadRequest,
        HttpApiError.NotFound,
        SimulatedRateLimitError,
        HttpApiError.InternalServerError,
        HttpApiError.ServiceUnavailable
      ]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getNewsletterSubscribers', '/api/admin/newsletter-subscribers', {
      success: NewsletterSubscribersResponse,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
