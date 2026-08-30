import { Slug } from '@gbfm/api/navigation'
import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  confirmHead,
  expectedSlugFor,
  makeHead,
  optimisticCapabilities,
  emptyTrail,
  localDestinationFor,
  mergeNeighbourhoodIntoTrail,
  neighbourhoodOf,
  preloadTargets,
  projectHead,
  shouldReconcileRoute,
  TRAIL_CAPACITY,
  trailNeighbours,
  visitSlug
} from './tweet-nav-state'

const asSlug = Schema.decodeUnknownSync(Slug)

describe('tweet nav head projection', () => {
  test('a fresh head is unconfirmed and offers no expected slug', () => {
    const head = makeHead(asSlug('alpha'))

    expect(head.slug).toBe('alpha')
    expect(head.confirmed).toBe(false)
    expect(expectedSlugFor(head, 'forward')).toBe(undefined)
    expect(expectedSlugFor(head, 'back')).toBe(undefined)
  })

  test('a confirmed head exposes its neighbours as expected slugs', () => {
    const head = confirmHead(asSlug('beta'), { back: asSlug('alpha'), forward: asSlug('gamma') })

    expect(expectedSlugFor(head, 'back')).toBe('alpha')
    expect(expectedSlugFor(head, 'forward')).toBe('gamma')
  })

  test('stepping forward from a confirmed head moves the head to the neighbour', () => {
    const head = confirmHead(asSlug('beta'), { back: asSlug('alpha'), forward: asSlug('gamma') })
    const next = projectHead(head, 'forward')

    expect(next.slug).toBe('gamma')
    expect(next.confirmed).toBe(false)
  })

  test('a second rapid step has no known neighbour so it keeps the slug and stays unconfirmed', () => {
    const head = confirmHead(asSlug('beta'), { back: asSlug('alpha'), forward: asSlug('gamma') })
    const first = projectHead(head, 'forward')
    const second = projectHead(first, 'forward')

    expect(second.slug).toBe('gamma')
    expect(second.confirmed).toBe(false)
    expect(expectedSlugFor(second, 'forward')).toBe(undefined)
  })

  test('an unconfirmed head never produces an optimistic destination', () => {
    const head = {
      slug: asSlug('beta'),
      neighbours: { forward: asSlug('gamma') },
      confirmed: false
    }

    expect(expectedSlugFor(head, 'forward')).toBe(undefined)
  })

  test('reconciliation is skipped when the optimistic destination matches the server', () => {
    expect(shouldReconcileRoute('gamma', 'gamma')).toBe(false)
  })

  test('reconciliation runs when there was no optimistic destination', () => {
    expect(shouldReconcileRoute(undefined, 'gamma')).toBe(true)
  })

  test('reconciliation runs when the optimistic destination was wrong', () => {
    expect(shouldReconcileRoute('gamma', 'delta')).toBe(true)
  })

  test('initial capabilities are optimistic so the controls are never dead on first paint', () => {
    expect(optimisticCapabilities.canStepBack).toBe(true)
    expect(optimisticCapabilities.canStepForward).toBe(true)
    expect(optimisticCapabilities.hasUnread).toBe(false)
  })
})

describe('neighbourhood derivation', () => {
  const baseResult = {
    destination: { slug: asSlug('beta'), postId: 'id-beta' },
    capabilities: optimisticCapabilities,
    trailPosition: { index: 0, length: 1 }
  }

  test('uses the deep neighbourhood when the server provides one', () => {
    const result = neighbourhoodOf({
      ...baseResult,
      neighbours: { back: asSlug('alpha'), forward: asSlug('gamma') },
      neighbourhood: {
        back: [asSlug('alpha'), asSlug('zeta')],
        forward: [asSlug('gamma'), asSlug('delta'), asSlug('epsilon')]
      }
    })

    expect(result.back).toEqual(['alpha', 'zeta'])
    expect(result.forward).toEqual(['gamma', 'delta', 'epsilon'])
  })

  test('falls back to the shallow neighbours when the neighbourhood is absent', () => {
    const result = neighbourhoodOf({
      ...baseResult,
      neighbours: { back: asSlug('alpha'), forward: asSlug('gamma') }
    })

    expect(result.back).toEqual(['alpha'])
    expect(result.forward).toEqual(['gamma'])
  })

  test('falls back to nothing when there are no neighbours at all', () => {
    const result = neighbourhoodOf({ ...baseResult, neighbours: {} })

    expect(result.back).toEqual([])
    expect(result.forward).toEqual([])
  })

  test('preload targets are capped per direction and deduplicated', () => {
    const targets = preloadTargets(
      { back: ['alpha', 'zeta', 'eta', 'theta'], forward: ['gamma', 'delta', 'alpha'] },
      3
    )

    expect(targets).toEqual(['alpha', 'zeta', 'eta', 'gamma', 'delta'])
  })
})

describe('local trail', () => {
  test('visiting a new slug appends it and moves the cursor to the end', () => {
    const trail = visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta')

    expect(trail.slugs).toEqual(['alpha', 'beta'])
    expect(trail.cursor).toBe(1)
  })

  test('revisiting a known slug moves the cursor without duplicating it', () => {
    const trail = visitSlug(visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta'), 'alpha')

    expect(trail.slugs).toEqual(['alpha', 'beta'])
    expect(trail.cursor).toBe(0)
  })

  test('visiting a new slug from the middle of the trail truncates the forward branch', () => {
    const walked = visitSlug(visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta'), 'gamma')
    const backToBeta = visitSlug(walked, 'beta')
    const branched = visitSlug(backToBeta, 'delta')

    expect(branched.slugs).toEqual(['alpha', 'beta', 'delta'])
    expect(branched.cursor).toBe(2)
  })

  test('the trail is bounded to the capacity, dropping the oldest entries', () => {
    let trail = emptyTrail
    for (let index = 0; index < TRAIL_CAPACITY + 10; index += 1) {
      trail = visitSlug(trail, `slug-${index}`)
    }

    expect(trail.slugs.length).toBe(TRAIL_CAPACITY)
    expect(trail.slugs[0]).toBe('slug-10')
    expect(trail.cursor).toBe(TRAIL_CAPACITY - 1)
  })

  test('prev and next come from the local trail with no network involved', () => {
    const walked = visitSlug(visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta'), 'gamma')
    const atBeta = visitSlug(walked, 'beta')

    expect(localDestinationFor(atBeta, 'beta', 'back')).toBe('alpha')
    expect(localDestinationFor(atBeta, 'beta', 'forward')).toBe('gamma')
  })

  test('the local trail offers nothing when the current slug is not where the cursor sits', () => {
    const walked = visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta')

    expect(localDestinationFor(walked, 'zeta', 'back')).toBe(undefined)
    expect(localDestinationFor(walked, 'zeta', 'forward')).toBe(undefined)
  })

  test('the local trail offers nothing at its edges', () => {
    const trail = visitSlug(emptyTrail, 'alpha')

    expect(localDestinationFor(trail, 'alpha', 'back')).toBe(undefined)
    expect(localDestinationFor(trail, 'alpha', 'forward')).toBe(undefined)
  })

  test('an empty trail has no neighbours', () => {
    expect(trailNeighbours(emptyTrail)).toEqual({ back: undefined, forward: undefined })
  })
})

describe('merging the server neighbourhood into the local trail', () => {
  test('a cold trail is seeded with the neighbourhood in both directions', () => {
    const trail = mergeNeighbourhoodIntoTrail(emptyTrail, 'beta', {
      back: ['alpha', 'zeta'],
      forward: ['gamma', 'delta']
    })

    expect(trail.slugs).toEqual(['zeta', 'alpha', 'beta', 'gamma', 'delta'])
    expect(trail.cursor).toBe(2)
    expect(localDestinationFor(trail, 'beta', 'back')).toBe('alpha')
    expect(localDestinationFor(trail, 'beta', 'forward')).toBe('gamma')
  })

  test('existing local history is preserved and only the open end is extended', () => {
    const walked = visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta')
    const merged = mergeNeighbourhoodIntoTrail(walked, 'beta', {
      back: ['alpha'],
      forward: ['gamma', 'delta']
    })

    expect(merged.slugs).toEqual(['alpha', 'beta', 'gamma', 'delta'])
    expect(merged.cursor).toBe(1)
  })

  test('slugs already in the trail are never duplicated by a merge', () => {
    const walked = visitSlug(visitSlug(visitSlug(emptyTrail, 'alpha'), 'beta'), 'gamma')
    const atAlpha = visitSlug(walked, 'alpha')
    const merged = mergeNeighbourhoodIntoTrail(atAlpha, 'alpha', {
      back: ['beta'],
      forward: ['gamma']
    })

    expect(merged.slugs).toEqual(['alpha', 'beta', 'gamma'])
    expect(merged.cursor).toBe(0)
  })

  test('a merge from a shallow fallback neighbourhood still yields a usable step', () => {
    const merged = mergeNeighbourhoodIntoTrail(emptyTrail, 'beta', { back: [], forward: ['gamma'] })

    expect(localDestinationFor(merged, 'beta', 'forward')).toBe('gamma')
    expect(localDestinationFor(merged, 'beta', 'back')).toBe(undefined)
  })

  test('the merged trail stays within capacity', () => {
    let trail = emptyTrail
    for (let index = 0; index < TRAIL_CAPACITY; index += 1) {
      trail = visitSlug(trail, `slug-${index}`)
    }
    const merged = mergeNeighbourhoodIntoTrail(trail, `slug-${TRAIL_CAPACITY - 1}`, {
      back: [],
      forward: ['fresh-a', 'fresh-b', 'fresh-c']
    })

    expect(merged.slugs.length).toBe(TRAIL_CAPACITY)
    expect(merged.slugs[merged.slugs.length - 1]).toBe('fresh-c')
  })
})
