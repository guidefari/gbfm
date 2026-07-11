import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const SOCIAL_LINK_PLATFORMS = [
  'bandcamp',
  'substack',
  'soundcloud',
  'instagram',
  'twitter',
  'tiktok'
] as const

const SocialLinkPlatform = Schema.Literals(SOCIAL_LINK_PLATFORMS)

// Schema.URLFromString decodes String -> URL (Type side is URL); every
// consumer of social links works with a plain string, so this uses a
// pattern check to keep Type = string, matching Uuid/Email elsewhere in
// this migration, rather than a real URL parse that would change the type.
const UrlPattern = /^https?:\/\/.+/i
const UrlString = Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))

const SocialLink = Schema.Struct({
  platform: SocialLinkPlatform,
  url: UrlString,
  position: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
})

export const SocialLinksInput = Schema.Array(SocialLink)
export const SocialLinksResponse = Schema.Array(SocialLink)

// Mirrors userTable's real columns (apps/vps/src/db/auth.schema.ts) as
// returned by UserService.getUserById/updateUserProfile -- role/banned/
// banReason/banExpires were never in the old selectUserSchema, but
// apps/www's own User type already declares an optional `role`, so the
// frontend is already relying on data the documented schema never promised.
export const UserProfileResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  avatarUrl: Schema.NullOr(Schema.String),
  verified: Schema.Boolean,
  socialLinks: SocialLinksResponse
})

// zod's z.email() "practical email" regex (zod/src/v4/core/regexes.ts) --
// a looser handwritten pattern here previously accepted malformed addresses
// like `..@x.c` that the old route's z.email() rejected.
const EmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const EmailField = Schema.String.pipe(Schema.check(Schema.isPattern(EmailPattern)))
const PasswordField = Schema.String.pipe(Schema.check(Schema.isMinLength(8)))
const BioField = Schema.String.pipe(Schema.check(Schema.isMaxLength(500)))

export const UpdateProfileJsonInput = Schema.Struct({
  email: Schema.optional(EmailField),
  password: Schema.optional(PasswordField),
  image: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  bio: Schema.optional(BioField)
})

// multipart/form-data variant of the same payload, for the avatar file
// upload path -- HttpApiEndpoint.payload accepts an array of differently
// -encoded schemas keyed by content-type (HttpApiEndpoint.ts's getPayload),
// so this and UpdateProfileJsonInput can both be declared on one endpoint.
export const UpdateProfileMultipartInput = Schema.Struct({
  email: Schema.optional(EmailField),
  password: Schema.optional(PasswordField),
  username: Schema.optional(Schema.String),
  bio: Schema.optional(BioField),
  avatar: Schema.optional(Schema.File)
}).pipe(HttpApiSchema.asMultipart())

const BioResponse = Schema.Struct({
  bio: Schema.NullOr(Schema.String)
})

export const UpdateAdminBioInput = Schema.Struct({
  bio: Schema.NullOr(BioField),
  image: Schema.optional(Schema.NullOr(Schema.String))
})

const EmailPreferences = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  mixReleaseEnabled: Schema.Boolean,
  promotionalEnabled: Schema.Boolean,
  systemEnabled: Schema.Boolean,
  globalUnsubscribe: Schema.Boolean,
  unsubscribeToken: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const UpdateEmailPreferencesInput = Schema.Struct({
  mixReleaseEnabled: Schema.optional(Schema.Boolean),
  promotionalEnabled: Schema.optional(Schema.Boolean),
  systemEnabled: Schema.optional(Schema.Boolean),
  globalUnsubscribe: Schema.optional(Schema.Boolean)
})

const PaginationMeta = Schema.Struct({
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean
})

const PaginationQuery = {
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })))
  ),
  offset: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  )
}

const ShowSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  bannerImageUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.String,
  draft: Schema.Boolean,
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

const SubscriptionWithShow = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  showId: Schema.String,
  createdAt: Schema.String,
  show: ShowSummary
})

export const GetUserSubscriptionsResponse = Schema.Struct({
  data: Schema.Array(SubscriptionWithShow),
  pagination: PaginationMeta
})

const DjListItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  mixCount: Schema.Number
})

export const ListDjsResponse = Schema.Array(DjListItem)

const SearchUserResult = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String)
})

export const SearchUsersResponse = Schema.Array(SearchUserResult)

const SearchUsersQuery = {
  q: Schema.NonEmptyString
}

const UserIdParam = { userId: Schema.String }

export const UserGroup = HttpApiGroup.make('user')
  .add(
    HttpApiEndpoint.patch('updateProfile', '/api/user/profile', {
      payload: [UpdateProfileJsonInput, UpdateProfileMultipartInput],
      success: UserProfileResponse,
      error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getProfile', '/api/user/profile', {
      success: UserProfileResponse,
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getSocialLinks', '/api/user/profile/social-links', {
      success: SocialLinksResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.put('replaceSocialLinks', '/api/user/profile/social-links', {
      payload: SocialLinksInput,
      success: SocialLinksResponse,
      error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getAdminUserSocialLinks', '/api/user/admin/:userId/social-links', {
      params: UserIdParam,
      success: SocialLinksResponse,
      error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.put('replaceAdminUserSocialLinks', '/api/user/admin/:userId/social-links', {
      params: UserIdParam,
      payload: SocialLinksInput,
      success: SocialLinksResponse,
      error: [
        HttpApiError.BadRequest,
        HttpApiError.Forbidden,
        HttpApiError.NotFound,
        HttpApiError.InternalServerError
      ]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('updateAdminUserBio', '/api/user/admin/:userId/bio', {
      params: UserIdParam,
      payload: UpdateAdminBioInput,
      success: BioResponse,
      error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getAdminUserBio', '/api/user/admin/:userId/bio', {
      params: UserIdParam,
      success: BioResponse,
      error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getEmailPreferences', '/api/user/email-preferences', {
      success: EmailPreferences,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('updateEmailPreferences', '/api/user/email-preferences', {
      payload: UpdateEmailPreferencesInput,
      success: EmailPreferences,
      error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getUserSubscriptions', '/api/user/subscriptions', {
      query: PaginationQuery,
      success: GetUserSubscriptionsResponse,
      error: HttpApiError.InternalServerError
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('listDjs', '/api/user/djs', {
      success: ListDjsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('searchUsers', '/api/user/search', {
      query: SearchUsersQuery,
      success: SearchUsersResponse,
      error: HttpApiError.InternalServerError
    }).middleware(AuthMiddleware)
  )
