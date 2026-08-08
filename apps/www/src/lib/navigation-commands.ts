import {
  IntentToken,
  Slug,
  type NavigateInput,
  type NavigationResultResponse
} from '@gbfm/api/navigation'
import { type Effect, Schema } from 'effect'

type NavigateMicroPosts = (input: NavigateInput) => Effect.Effect<NavigationResultResponse, unknown>

type CommandInput = {
  readonly from: string
  readonly intentToken: string
}

const decodeSlug = Schema.decodeUnknownSync(Slug)
const decodeIntentToken = Schema.decodeUnknownSync(IntentToken)

const toNavigateInput = (input: CommandInput) => ({
  from: decodeSlug(input.from),
  intentToken: decodeIntentToken(input.intentToken)
})

export const stepBack = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({
    command: { _tag: 'Step', direction: 'Back' },
    ...toNavigateInput(input)
  })

export const stepForward = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({
    command: { _tag: 'Step', direction: 'Forward' },
    ...toNavigateInput(input)
  })

export const jump = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({ command: { _tag: 'Jump' }, ...toNavigateInput(input) })

export const open = (
  navigate: NavigateMicroPosts,
  input: CommandInput & { readonly slug: string }
) =>
  navigate({
    command: { _tag: 'Open', slug: decodeSlug(input.slug) },
    ...toNavigateInput(input)
  })
