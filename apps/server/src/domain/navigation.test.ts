import { Option, Result, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  applyCommand,
  capabilitiesOf,
  NavigationCommand,
  NavigationIdentity,
  NoSuchMove,
  type NavigationSession,
  type ResolvedDestination,
  Slug,
  type TrailEntry,
} from './navigation'

const slug = (value: string) => Schema.decodeUnknownSync(Slug)(value)

const destination = (value: string, visitedAt = 1): ResolvedDestination => ({
  slug: slug(value),
  postId: `${value}-id`,
  visitedAt,
})

const entry = (value: string, visitedAt = 1): TrailEntry => ({
  ...destination(value, visitedAt),
  arrivedBy: 'Open',
})

const session = (
  trail: ReadonlyArray<TrailEntry>,
  cursor: number,
  seenSlugs = new Set(trail.map((trailEntry) => trailEntry.slug)),
): NavigationSession => ({
  id: 'session-id',
  identity: NavigationIdentity.Anonymous({ deviceToken: 'device-token' }),
  trail,
  cursor,
  seenSlugs,
})

const succeeds = <Value>(result: Result.Result<Value, unknown>): Value => {
  if (Result.isFailure(result)) {
    throw result.failure
  }

  return result.success
}

describe('applyCommand', () => {
  test('rejects Step(Back) at the start of the trail', () => {
    const result = applyCommand(
      session([entry('first')], 0),
      NavigationCommand.Step({ direction: 'Back' }),
      Option.none(),
    )

    if (Result.isSuccess(result)) {
      throw new Error('Step(Back) unexpectedly succeeded')
    }

    expect(result.failure).toMatchObject(new NoSuchMove({ command: 'Step(Back)' }))
  })

  test('replays Step(Back) without changing the trail', () => {
    const original = session([entry('first'), entry('second'), entry('third')], 2)

    const updated = succeeds(
      applyCommand(original, NavigationCommand.Step({ direction: 'Back' }), Option.none()),
    )

    expect(updated.cursor).toBe(1)
    expect(updated.trail).toStrictEqual(original.trail)
  })

  test('replays Step(Forward) after Step(Back)', () => {
    const original = session([entry('first'), entry('second'), entry('third')], 2)

    const rewound = succeeds(
      applyCommand(original, NavigationCommand.Step({ direction: 'Back' }), Option.none()),
    )

    const replayed = succeeds(
      applyCommand(rewound, NavigationCommand.Step({ direction: 'Forward' }), Option.none()),
    )

    expect(replayed.cursor).toBe(2)
    expect(replayed.trail[replayed.cursor]).toStrictEqual(original.trail[original.cursor])
  })

  test('replays Step(Forward) from a rewound cursor without appending', () => {
    const original = session(
      [entry('first'), entry('second'), entry('third'), entry('fourth'), entry('fifth')],
      4,
    )

    const once = succeeds(
      applyCommand(original, NavigationCommand.Step({ direction: 'Back' }), Option.none()),
    )

    const twice = succeeds(
      applyCommand(once, NavigationCommand.Step({ direction: 'Back' }), Option.none()),
    )

    const rewound = succeeds(
      applyCommand(twice, NavigationCommand.Step({ direction: 'Back' }), Option.none()),
    )

    const replayed = succeeds(
      applyCommand(rewound, NavigationCommand.Step({ direction: 'Forward' }), Option.none()),
    )

    expect(replayed.cursor).toBe(2)
    expect(replayed.trail).toStrictEqual(original.trail)
  })

  test('appends Open to an empty trail at cursor zero', () => {
    const updated = succeeds(
      applyCommand(
        session([], 0),
        NavigationCommand.Open({ slug: slug('first') }),
        Option.some(destination('first')),
      ),
    )

    expect(updated.trail).toStrictEqual([{ ...entry('first'), arrivedBy: 'Open' }])
    expect(updated.cursor).toBe(0)
  })

  test('moves the cursor for Open of a current trail entry without appending', () => {
    const original = session([entry('first'), entry('second')], 1)

    const updated = succeeds(
      applyCommand(
        original,
        NavigationCommand.Open({ slug: slug('first') }),
        Option.some(destination('first')),
      ),
    )

    expect(updated.cursor).toBe(0)
    expect(updated.trail).toStrictEqual(original.trail)
  })

  test('appends Step(Forward) and Jump at the end of the trail', () => {
    const original = session([entry('first')], 0)

    const forward = succeeds(
      applyCommand(
        original,
        NavigationCommand.Step({ direction: 'Forward' }),
        Option.some(destination('second')),
      ),
    )

    const jumped = succeeds(
      applyCommand(original, NavigationCommand.Jump(), Option.some(destination('third'))),
    )

    expect(forward.trail).toStrictEqual([entry('first'), { ...entry('second'), arrivedBy: 'Step' }])
    expect(jumped.trail).toStrictEqual([entry('first'), { ...entry('third'), arrivedBy: 'Jump' }])
    expect(forward.cursor).toBe(1)
    expect(jumped.cursor).toBe(1)
  })

  test('never appends a slug already in the trail', () => {
    const original = session([entry('first')], 0, new Set())

    const forward = applyCommand(
      original,
      NavigationCommand.Step({ direction: 'Forward' }),
      Option.some(destination('first')),
    )

    const jumped = applyCommand(
      original,
      NavigationCommand.Jump(),
      Option.some(destination('first')),
    )

    expect(Result.isFailure(forward)).toBe(true)
    expect(Result.isFailure(jumped)).toBe(true)
  })

  test('appends an Open of a seen slug after it was evicted from the trail', () => {
    const fullTrail = Array.from({ length: 500 }, (_, index) => entry(`tweet-${index}`, index))

    const evicted = succeeds(
      applyCommand(
        session(fullTrail, 499),
        NavigationCommand.Step({ direction: 'Forward' }),
        Option.some(destination('tweet-500', 500)),
      ),
    )

    const reopened = succeeds(
      applyCommand(
        evicted,
        NavigationCommand.Open({ slug: slug('tweet-0') }),
        Option.some(destination('tweet-0', 501)),
      ),
    )

    expect(reopened.trail).toHaveLength(500)
    expect(reopened.trail[0]?.slug).toBe(slug('tweet-2'))
    expect(reopened.trail[499]?.slug).toBe(slug('tweet-0'))
    expect(reopened.cursor).toBe(499)
    expect(reopened.seenSlugs.has(slug('tweet-0'))).toBe(true)
  })

  test('keeps seen slugs unavailable to Step(Forward) and Jump after trail eviction', () => {
    const fullTrail = Array.from({ length: 500 }, (_, index) => entry(`tweet-${index}`, index))
    const original = session(fullTrail, 499)

    const updated = succeeds(
      applyCommand(
        original,
        NavigationCommand.Step({ direction: 'Forward' }),
        Option.some(destination('tweet-500', 500)),
      ),
    )

    const repeatedForward = applyCommand(
      updated,
      NavigationCommand.Step({ direction: 'Forward' }),
      Option.some(destination('tweet-0', 501)),
    )

    const repeatedJump = applyCommand(
      updated,
      NavigationCommand.Jump(),
      Option.some(destination('tweet-0', 501)),
    )

    expect(updated.trail).toHaveLength(500)
    expect(updated.trail[0]?.slug).toBe(slug('tweet-1'))
    expect(updated.trail[499]?.slug).toBe(slug('tweet-500'))
    expect(updated.cursor).toBe(499)
    expect(updated.seenSlugs.has(slug('tweet-0'))).toBe(true)
    expect(Result.isFailure(repeatedForward)).toBe(true)
    expect(Result.isFailure(repeatedJump)).toBe(true)
  })
})

describe('capabilitiesOf', () => {
  const original = session([entry('first'), entry('second')], 0)

  test('allows Step(Forward) while the trail has an entry ahead', () => {
    expect(
      capabilitiesOf(original.cursor, original.trail.length, { hasUnread: false }),
    ).toStrictEqual({
      canStepBack: false,
      canStepForward: true,
      hasUnread: false,
    })
  })

  test('allows Step(Forward) at the end while unread tweets remain', () => {
    expect(capabilitiesOf(1, original.trail.length, { hasUnread: true })).toStrictEqual({
      canStepBack: true,
      canStepForward: true,
      hasUnread: true,
    })
  })

  test('disables Step(Forward only at the end with no unread tweets', () => {
    expect(capabilitiesOf(1, original.trail.length, { hasUnread: false })).toStrictEqual({
      canStepBack: true,
      canStepForward: false,
      hasUnread: false,
    })
  })
})
