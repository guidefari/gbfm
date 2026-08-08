import { Option, Result, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  applyCommand,
  capabilitiesOf,
  type NavigationCommand,
  type NavigationSession,
  type ResolvedDestination,
  Slug,
  type TrailEntry
} from './navigation'

const slug = (value: string) => Schema.decodeUnknownSync(Slug)(value)

const destination = (value: string, visitedAt = 1): ResolvedDestination => ({
  slug: slug(value),
  postId: `${value}-id`,
  visitedAt
})

const entry = (value: string, visitedAt = 1): TrailEntry => ({
  ...destination(value, visitedAt),
  arrivedBy: 'Open'
})

const session = (
  trail: readonly TrailEntry[],
  cursor: number,
  seenSlugs = new Set(trail.map((trailEntry) => trailEntry.slug))
): NavigationSession => ({
  id: 'session-id',
  trail,
  cursor,
  seenSlugs
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
      { _tag: 'Step', direction: 'Back' },
      Option.none()
    )

    if (Result.isSuccess(result)) {
      throw new Error('Step(Back) unexpectedly succeeded')
    }

    expect(result.failure).toMatchObject({
      _tag: 'NoSuchMove',
      command: 'Step(Back)'
    })
  })

  test('replays Step(Back) without changing the trail', () => {
    const original = session([entry('first'), entry('second'), entry('third')], 2)

    const updated = succeeds(
      applyCommand(original, { _tag: 'Step', direction: 'Back' }, Option.none())
    )

    expect(updated.cursor).toBe(1)
    expect(updated.trail).toStrictEqual(original.trail)
  })

  test('replays Step(Forward) after Step(Back)', () => {
    const original = session([entry('first'), entry('second'), entry('third')], 2)
    const rewound = succeeds(
      applyCommand(original, { _tag: 'Step', direction: 'Back' }, Option.none())
    )

    const replayed = succeeds(
      applyCommand(rewound, { _tag: 'Step', direction: 'Forward' }, Option.none())
    )

    expect(replayed.cursor).toBe(2)
    expect(replayed.trail[replayed.cursor]).toStrictEqual(original.trail[original.cursor])
  })

  test('replays Step(Forward) from a rewound cursor without appending', () => {
    const original = session(
      [entry('first'), entry('second'), entry('third'), entry('fourth'), entry('fifth')],
      4
    )
    const once = succeeds(
      applyCommand(original, { _tag: 'Step', direction: 'Back' }, Option.none())
    )
    const twice = succeeds(applyCommand(once, { _tag: 'Step', direction: 'Back' }, Option.none()))
    const rewound = succeeds(
      applyCommand(twice, { _tag: 'Step', direction: 'Back' }, Option.none())
    )

    const replayed = succeeds(
      applyCommand(rewound, { _tag: 'Step', direction: 'Forward' }, Option.none())
    )

    expect(replayed.cursor).toBe(2)
    expect(replayed.trail).toStrictEqual(original.trail)
  })

  test('does not move for an idempotent Open of the current trail entry', () => {
    const original = session([entry('first'), entry('second')], 1)

    const updated = succeeds(
      applyCommand(
        original,
        { _tag: 'Open', slug: slug('second') },
        Option.some(destination('second'))
      )
    )

    expect(updated).toStrictEqual(original)
  })

  test('appends Step(Forward) and Jump at the end of the trail', () => {
    const original = session([entry('first')], 0)
    const forward = succeeds(
      applyCommand(
        original,
        { _tag: 'Step', direction: 'Forward' },
        Option.some(destination('second'))
      )
    )
    const jumped = succeeds(
      applyCommand(original, { _tag: 'Jump' }, Option.some(destination('third')))
    )

    expect(forward.trail).toStrictEqual([entry('first'), { ...entry('second'), arrivedBy: 'Step' }])
    expect(jumped.trail).toStrictEqual([entry('first'), { ...entry('third'), arrivedBy: 'Jump' }])
    expect(forward.cursor).toBe(1)
    expect(jumped.cursor).toBe(1)
  })

  test('never appends a slug already in the trail', () => {
    const original = session([entry('first')], 0)
    const forward = applyCommand(
      original,
      { _tag: 'Step', direction: 'Forward' },
      Option.some(destination('first'))
    )
    const jumped = applyCommand(original, { _tag: 'Jump' }, Option.some(destination('first')))

    expect(Result.isFailure(forward)).toBe(true)
    expect(Result.isFailure(jumped)).toBe(true)
  })

  test('evicts only the oldest trail entry while retaining its seen slug', () => {
    const fullTrail = Array.from({ length: 500 }, (_, index) => entry(`tweet-${index}`, index))
    const original = session(fullTrail, 499)

    const updated = succeeds(
      applyCommand(
        original,
        { _tag: 'Step', direction: 'Forward' },
        Option.some(destination('tweet-500', 500))
      )
    )
    const repeatedForward = applyCommand(
      updated,
      { _tag: 'Step', direction: 'Forward' },
      Option.some(destination('tweet-0', 501))
    )
    const repeatedJump = applyCommand(
      updated,
      { _tag: 'Jump' },
      Option.some(destination('tweet-0', 501))
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
    expect(capabilitiesOf(original, { hasUnread: false })).toStrictEqual({
      canStepBack: false,
      canStepForward: true,
      hasUnread: false
    })
  })

  test('allows Step(Forward) at the end while unread tweets remain', () => {
    expect(capabilitiesOf({ ...original, cursor: 1 }, { hasUnread: true })).toStrictEqual({
      canStepBack: true,
      canStepForward: true,
      hasUnread: true
    })
  })

  test('disables Step(Forward only at the end with no unread tweets', () => {
    expect(capabilitiesOf({ ...original, cursor: 1 }, { hasUnread: false })).toStrictEqual({
      canStepBack: true,
      canStepForward: false,
      hasUnread: false
    })
  })
})
