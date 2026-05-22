import { z } from '@hono/zod-openapi'

export const adminOverviewContentBreakdownSchema = z.object({
  published: z.number(),
  drafts: z.number(),
  newLast7Days: z.number()
})

export const adminOverviewRecentContentItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string(),
  type: z.enum([
    'mix',
    'track',
    'misc',
    'show',
    'post',
    'micro',
    'label',
    'release'
  ]),
  createdAt: z.string(),
  draft: z.boolean()
})

export const adminOverviewTopMixSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  playCount: z.number(),
  createdAt: z.string(),
  creators: z.array(z.string())
})

export const adminOverviewRecentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
  emailVerified: z.boolean()
})

export const adminOverviewRecentSubscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  source: z.string().nullable(),
  createdAt: z.string()
})

export const adminOverviewRecentEmailFailureSchema = z.object({
  id: z.string(),
  recipientEmail: z.string(),
  subject: z.string(),
  status: z.string(),
  createdAt: z.string(),
  errorMessage: z.string().nullable()
})

export const adminOverviewResponseSchema = z.object({
  generatedAt: z.string(),
  highlights: z.object({
    totalUsers: z.number(),
    verifiedUsers: z.number(),
    newsletterSubscribers: z.number(),
    totalPlayCount: z.number(),
    publishedMixes: z.number(),
    newUsersLast7Days: z.number(),
    newSubscribersLast30Days: z.number(),
    newMixesLast30Days: z.number()
  }),
  publishing: z.object({
    mixes: adminOverviewContentBreakdownSchema,
    tracks: adminOverviewContentBreakdownSchema,
    miscAudio: adminOverviewContentBreakdownSchema,
    shows: adminOverviewContentBreakdownSchema,
    posts: adminOverviewContentBreakdownSchema,
    micros: adminOverviewContentBreakdownSchema,
    labels: adminOverviewContentBreakdownSchema,
    releases: adminOverviewContentBreakdownSchema,
    recentContent: z.array(adminOverviewRecentContentItemSchema),
    topMixes: z.array(adminOverviewTopMixSchema)
  }),
  community: z.object({
    users: z.object({
      total: z.number(),
      verified: z.number(),
      admins: z.number(),
      editors: z.number(),
      creators: z.number(),
      banned: z.number(),
      newLast7Days: z.number(),
      newLast30Days: z.number()
    }),
    sessions: z.object({
      active: z.number()
    }),
    newsletter: z.object({
      total: z.number(),
      newLast7Days: z.number(),
      newLast30Days: z.number()
    }),
    engagement: z.object({
      favoritesTotal: z.number(),
      showSubscriptionsTotal: z.number()
    }),
    recentUsers: z.array(adminOverviewRecentUserSchema),
    recentSubscribers: z.array(adminOverviewRecentSubscriberSchema)
  }),
  operations: z.object({
    emails: z.object({
      total: z.number(),
      sent: z.number(),
      delivered: z.number(),
      bounced: z.number(),
      complained: z.number(),
      failed: z.number(),
      pending: z.number(),
      failedLast7Days: z.number(),
      recentFailures: z.array(adminOverviewRecentEmailFailureSchema)
    }),
    reminders: z.object({
      pending: z.number(),
      processing: z.number(),
      failed: z.number(),
      dueNow: z.number()
    })
  })
})

export type AdminOverview = z.infer<typeof adminOverviewResponseSchema>
export type AdminOverviewContentBreakdown = z.infer<
  typeof adminOverviewContentBreakdownSchema
>
