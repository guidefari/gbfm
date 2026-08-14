import { IntentToken, Slug, type NavigateInput } from '@gbfm/api/navigation'
import { Schema } from 'effect'
import type { ApiClient } from '@/lib/api-client'

type NavigateMicroPostsRequest = ApiClient['navigation']['navigateMicroPosts']

export type NavigateMicroPosts = (input: NavigateInput) => ReturnType<NavigateMicroPostsRequest>

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
