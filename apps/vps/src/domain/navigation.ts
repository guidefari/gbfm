import { Option, Result, Schema } from 'effect'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))
export type Slug = typeof Slug.Type

export type NavigationCommand =
  | { readonly _tag: 'Step'; readonly direction: 'Back' | 'Forward' }
  | { readonly _tag: 'Jump' }
  | { readonly _tag: 'Open'; readonly slug: Slug }

export type TrailEntry = {
  readonly slug: Slug
  readonly postId: string
  readonly visitedAt: number
  readonly arrivedBy: 'Step' | 'Jump' | 'Open'
}

export type NavigationIdentity =
  | { readonly _tag: 'User'; readonly userId: string }
  | { readonly _tag: 'Anonymous'; readonly deviceToken: string }

export type NavigationSession = {
  readonly id: string
  readonly identity: NavigationIdentity
  readonly trail: readonly TrailEntry[]
  readonly cursor: number
  readonly seenSlugs: ReadonlySet<Slug>
}

export type NavigationCapabilities = {
  readonly canStepBack: boolean
  readonly canStepForward: boolean
  readonly hasUnread: boolean
}

export type NavigationResult = {
  readonly destination: { readonly slug: Slug; readonly postId: string }
  readonly capabilities: NavigationCapabilities
  readonly trailPosition: { readonly index: number; readonly length: number }
}

export type ResolvedDestination = {
  readonly slug: Slug
  readonly postId: string
  readonly visitedAt: number
}

export type UnreadPick = 'NextByDate' | 'Random'

export type CorpusFacts = {
  readonly hasUnread: boolean
}

export class NoSuchMove extends Schema.TaggedErrorClass<NoSuchMove>()('NoSuchMove', {
  command: Schema.String
}) {}

export class TrailEntryGone extends Schema.TaggedErrorClass<TrailEntryGone>()('TrailEntryGone', {
  slug: Schema.String
}) {}

export class CorpusExhausted extends Schema.TaggedErrorClass<CorpusExhausted>()(
  'CorpusExhausted',
  {}
) {}

const TRAIL_CAPACITY = 500

const noSuchMove = (command: NavigationCommand) =>
  new NoSuchMove({
    command: command._tag === 'Step' ? `Step(${command.direction})` : command._tag
  })

const append = (
  session: NavigationSession,
  destination: ResolvedDestination,
  arrivedBy: TrailEntry['arrivedBy']
): NavigationSession => {
  const trail = [
    ...session.trail,
    {
      slug: destination.slug,
      postId: destination.postId,
      visitedAt: destination.visitedAt,
      arrivedBy
    }
  ]
  const retainedTrail = trail.length > TRAIL_CAPACITY ? trail.slice(1) : trail

  return {
    ...session,
    trail: retainedTrail,
    cursor: retainedTrail.length - 1,
    seenSlugs: new Set([...session.seenSlugs, destination.slug])
  }
}

const appendResolved = (
  session: NavigationSession,
  command: NavigationCommand,
  resolved: Option.Option<ResolvedDestination>
): Result.Result<NavigationSession, NoSuchMove> => {
  if (
    Option.isNone(resolved) ||
    session.trail.some((entry) => entry.slug === resolved.value.slug)
  ) {
    return Result.fail(noSuchMove(command))
  }

  if (command._tag !== 'Open' && session.seenSlugs.has(resolved.value.slug)) {
    return Result.fail(noSuchMove(command))
  }

  return Result.succeed(append(session, resolved.value, command._tag))
}

export const applyCommand = (
  session: NavigationSession,
  command: NavigationCommand,
  resolved: Option.Option<ResolvedDestination>
): Result.Result<NavigationSession, NoSuchMove> => {
  switch (command._tag) {
    case 'Step':
      if (command.direction === 'Back') {
        if (session.cursor === 0) {
          return Result.fail(noSuchMove(command))
        }

        return Result.succeed({ ...session, cursor: session.cursor - 1 })
      }

      if (session.cursor < session.trail.length - 1) {
        return Result.succeed({ ...session, cursor: session.cursor + 1 })
      }

      return appendResolved(session, command, resolved)
    case 'Jump':
      return appendResolved(session, command, resolved)
    case 'Open': {
      const index = session.trail.findIndex((entry) => entry.slug === command.slug)
      if (index >= 0) {
        return Result.succeed({ ...session, cursor: index })
      }

      return appendResolved(session, command, resolved)
    }
  }
}

export const capabilitiesOf = (
  session: NavigationSession,
  corpus: CorpusFacts
): NavigationCapabilities => ({
  canStepBack: session.cursor > 0,
  canStepForward: session.cursor < session.trail.length - 1 || corpus.hasUnread,
  hasUnread: corpus.hasUnread
})
