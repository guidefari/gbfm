import {
  IntentToken,
  Slug,
  type NavigateInput,
  type NavigationPeekInput,
  type NavigationVisitInput,
} from '@gbfm/api/navigation'
import { Data, Schema } from 'effect'

import type { ApiClient } from '@/lib/api-client'

type NavigateMicroPostsRequest = ApiClient['navigation']['navigateMicroPosts']

type PeekMicroPostNavigationRequest = ApiClient['navigation']['peekMicroPostNavigation']

type RecordMicroPostVisitRequest = ApiClient['navigation']['recordMicroPostVisit']

export type NavigateMicroPosts = (input: NavigateInput) => ReturnType<NavigateMicroPostsRequest>

export type PeekMicroPostNavigation = (
  input: NavigationPeekInput,
) => ReturnType<PeekMicroPostNavigationRequest>

export type RecordMicroPostVisit = (
  input: NavigationVisitInput,
) => ReturnType<RecordMicroPostVisitRequest>

type CommandInput = {
  readonly from: string
  readonly intentToken: string
}

const decodeSlug = Schema.decodeUnknownSync(Slug)

const decodeIntentToken = Schema.decodeUnknownSync(IntentToken)

const Command = Data.taggedEnum<NavigateInput['command']>()

const toNavigateInput = (input: CommandInput) => ({
  from: decodeSlug(input.from),
  intentToken: decodeIntentToken(input.intentToken),
})

export const stepBack = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({
    command: Command.Step({ direction: 'Back' }),
    ...toNavigateInput(input),
  })

export const stepForward = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({
    command: Command.Step({ direction: 'Forward' }),
    ...toNavigateInput(input),
  })

export const jump = (navigate: NavigateMicroPosts, input: CommandInput) =>
  navigate({ command: Command.Jump(), ...toNavigateInput(input) })

export const open = (
  navigate: NavigateMicroPosts,
  input: CommandInput & { readonly slug: string },
) =>
  navigate({
    command: Command.Open({ slug: decodeSlug(input.slug) }),
    ...toNavigateInput(input),
  })

const toPeekInput = (input: { readonly from: string }) => ({ from: decodeSlug(input.from) })

export const peekStepBack = (peek: PeekMicroPostNavigation, input: { readonly from: string }) =>
  peek({
    command: Command.Step({ direction: 'Back' }),
    ...toPeekInput(input),
  })

export const peekStepForward = (peek: PeekMicroPostNavigation, input: { readonly from: string }) =>
  peek({
    command: Command.Step({ direction: 'Forward' }),
    ...toPeekInput(input),
  })

export const peekJump = (peek: PeekMicroPostNavigation, input: { readonly from: string }) =>
  peek({ command: Command.Jump(), ...toPeekInput(input) })

export const peekOpen = (
  peek: PeekMicroPostNavigation,
  input: { readonly from: string; readonly slug: string },
) =>
  peek({
    command: Command.Open({ slug: decodeSlug(input.slug) }),
    ...toPeekInput(input),
  })

export const visitStepBack = (visit: RecordMicroPostVisit, input: CommandInput) =>
  visit({
    command: Command.Step({ direction: 'Back' }),
    ...toNavigateInput(input),
  })

export const visitStepForward = (visit: RecordMicroPostVisit, input: CommandInput) =>
  visit({
    command: Command.Step({ direction: 'Forward' }),
    ...toNavigateInput(input),
  })

export const visitJump = (visit: RecordMicroPostVisit, input: CommandInput) =>
  visit({ command: Command.Jump(), ...toNavigateInput(input) })

export const visitOpen = (
  visit: RecordMicroPostVisit,
  input: CommandInput & { readonly slug: string },
) =>
  visit({
    command: Command.Open({ slug: decodeSlug(input.slug) }),
    ...toNavigateInput(input),
  })
