import { Data, Match, Option, Predicate, Result, Schema } from 'effect'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))

export type Slug = typeof Slug.Type

export type NavigationCommand =
  | { readonly _tag: 'Step'; readonly direction: 'Back' | 'Forward' }
  | { readonly _tag: 'Jump' }
  | { readonly _tag: 'Open'; readonly slug: Slug }

export const NavigationCommand = Data.taggedEnum<NavigationCommand>()

export type TrailEntry = {
  readonly slug: Slug
  readonly postId: string
  readonly visitedAt: number
  readonly arrivedBy: 'Step' | 'Jump' | 'Open'
}

export type NavigationIdentity =
  | { readonly _tag: 'User'; readonly userId: string }
  | { readonly _tag: 'Anonymous'; readonly deviceToken: string }

export const NavigationIdentity = Data.taggedEnum<NavigationIdentity>()

export type NavigationSession = {
  readonly id: string
  readonly identity: NavigationIdentity
  readonly trail: ReadonlyArray<TrailEntry>
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
  readonly neighbours: { readonly back?: Slug; readonly forward?: Slug }
  readonly neighbourhood: {
    readonly back: ReadonlyArray<Slug>
    readonly forward: ReadonlyArray<Slug>
  }
}

export const NEIGHBOURHOOD_DEPTH = 3

export type ResolvedDestination = {
  readonly slug: Slug
  readonly postId: string
  readonly visitedAt: number
}

export type UnreadPick = 'NextByDate' | 'Random'

export type CorpusFacts = {
  readonly hasUnread: boolean
}

export class NoSuchMove extends Schema.TaggedError<NoSuchMove>()('NoSuchMove', {
  command: Schema.String,
}) {}

export class TrailEntryGone extends Schema.TaggedError<TrailEntryGone>()('TrailEntryGone', {
  slug: Schema.String,
}) {}

export class CorpusExhausted extends Schema.TaggedError<CorpusExhausted>()('CorpusExhausted', {}) {}

const TRAIL_CAPACITY = 500

const noSuchMove = (command: NavigationCommand) =>
  new NoSuchMove({
    command: Predicate.isTagged(command, 'Step') ? `Step(${command.direction})` : command._tag,
  })

const append = (
  session: NavigationSession,
  destination: ResolvedDestination,
  arrivedBy: TrailEntry['arrivedBy'],
): NavigationSession => {
  const trail = [
    ...session.trail,
    {
      slug: destination.slug,
      postId: destination.postId,
      visitedAt: destination.visitedAt,
      arrivedBy,
    },
  ]

  const retainedTrail = trail.length > TRAIL_CAPACITY ? trail.slice(1) : trail

  return {
    ...session,
    trail: retainedTrail,
    cursor: retainedTrail.length - 1,
    seenSlugs: new Set([...session.seenSlugs, destination.slug]),
  }
}

const appendResolved = (
  session: NavigationSession,
  command: NavigationCommand,
  resolved: Option.Option<ResolvedDestination>,
): Result.Result<NavigationSession, NoSuchMove> => {
  if (
    Option.isNone(resolved) ||
    session.trail.some((entry) => entry.slug === resolved.value.slug)
  ) {
    return Result.fail(noSuchMove(command))
  }

  if (!Predicate.isTagged(command, 'Open') && session.seenSlugs.has(resolved.value.slug)) {
    return Result.fail(noSuchMove(command))
  }

  return Result.succeed(append(session, resolved.value, command._tag))
}

export const applyCommand = (
  session: NavigationSession,
  command: NavigationCommand,
  resolved: Option.Option<ResolvedDestination>,
): Result.Result<NavigationSession, NoSuchMove> => {
  return Match.value(command).pipe(
    Match.tag('Step', (command) => {
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
    }),
    Match.tag('Jump', (command) => appendResolved(session, command, resolved)),
    Match.tag('Open', (command) => {
      const index = session.trail.findIndex((entry) => entry.slug === command.slug)

      if (index >= 0) {
        return Result.succeed({ ...session, cursor: index })
      }

      return appendResolved(session, command, resolved)
    }),
    Match.exhaustive,
  )
}

export const capabilitiesOf = (
  cursor: number,
  trailLength: number,
  corpus: CorpusFacts,
): NavigationCapabilities => ({
  canStepBack: cursor > 0,
  canStepForward: cursor < trailLength - 1 || corpus.hasUnread,
  hasUnread: corpus.hasUnread,
})
