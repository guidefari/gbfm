import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))
export type Slug = typeof Slug.Type

export const IntentToken = Schema.NonEmptyString
export type IntentToken = typeof IntentToken.Type

export const NavigationCommand = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal('Step'),
    direction: Schema.Literals(['Back', 'Forward'])
  }),
  Schema.Struct({ _tag: Schema.Literal('Jump') }),
  Schema.Struct({ _tag: Schema.Literal('Open'), slug: Slug })
])
export type NavigationCommand = typeof NavigationCommand.Type

export const NavigateInput = Schema.Struct({
  command: NavigationCommand,
  from: Slug,
  intentToken: IntentToken
})
export type NavigateInput = typeof NavigateInput.Type

const NavigationCapabilitiesResponse = Schema.Struct({
  canStepBack: Schema.Boolean,
  canStepForward: Schema.Boolean,
  hasUnread: Schema.Boolean
})

export const NavigationResultResponse = Schema.Struct({
  destination: Schema.Struct({ slug: Slug, postId: Schema.String }),
  capabilities: NavigationCapabilitiesResponse,
  trailPosition: Schema.Struct({ index: Schema.Number, length: Schema.Number }),
  neighbours: Schema.Struct({ back: Schema.optional(Slug), forward: Schema.optional(Slug) })
})
export type NavigationResultResponse = typeof NavigationResultResponse.Type

export const NavigationSessionResponse = Schema.Struct({
  slug: Schema.NullOr(Slug),
  capabilities: NavigationCapabilitiesResponse
})
export type NavigationSessionResponse = typeof NavigationSessionResponse.Type

export const NavigationGroup = HttpApiGroup.make('navigation')
  .add(
    HttpApiEndpoint.post('navigateMicroPosts', '/api/content/posts/micro/navigate', {
      payload: NavigateInput,
      success: NavigationResultResponse,
      error: [HttpApiError.NotFound, HttpApiError.Conflict, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get(
      'getMicroPostNavigationSession',
      '/api/content/posts/micro/navigation-session',
      {
        success: NavigationSessionResponse,
        error: [HttpApiError.InternalServerError]
      }
    )
  )
