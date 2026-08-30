import type { NavigationResultResponse } from '@gbfm/api/navigation'

export type Capabilities = NavigationResultResponse['capabilities']
export type Neighbours = NavigationResultResponse['neighbours']

export type NavigationHead = {
  readonly slug: string
  readonly neighbours: Neighbours
  readonly confirmed: boolean
}

export const optimisticCapabilities: Capabilities = {
  canStepBack: true,
  canStepForward: true,
  hasUnread: false
}

export const makeHead = (slug: string): NavigationHead => ({
  slug,
  neighbours: {},
  confirmed: false
})

export const confirmHead = (slug: string, neighbours: Neighbours): NavigationHead => ({
  slug,
  neighbours,
  confirmed: true
})

export type Step = 'back' | 'forward'

export const projectHead = (head: NavigationHead, step: Step): NavigationHead => {
  const target = step === 'back' ? head.neighbours.back : head.neighbours.forward
  return target === undefined ? { ...head, confirmed: false } : makeHead(target)
}

export const expectedSlugFor = (head: NavigationHead, step: Step) =>
  head.confirmed ? (step === 'back' ? head.neighbours.back : head.neighbours.forward) : undefined

export const shouldAcceptResult = (intentId: number, latestIntentId: number) =>
  intentId === latestIntentId

export const shouldReconcileRoute = (expectedSlug: string | undefined, destinationSlug: string) =>
  expectedSlug !== destinationSlug

export type Neighbourhood = {
  readonly back: readonly string[]
  readonly forward: readonly string[]
}

export const TRAIL_CAPACITY = 500

export const emptyNeighbourhood: Neighbourhood = { back: [], forward: [] }

export const neighbourhoodOf = (result: NavigationResultResponse): Neighbourhood => {
  if (result.neighbourhood) {
    return { back: [...result.neighbourhood.back], forward: [...result.neighbourhood.forward] }
  }

  return {
    back: result.neighbours.back ? [result.neighbours.back] : [],
    forward: result.neighbours.forward ? [result.neighbours.forward] : []
  }
}

export const preloadTargets = (neighbourhood: Neighbourhood, depth: number): readonly string[] => {
  const candidates = [
    ...neighbourhood.back.slice(0, depth),
    ...neighbourhood.forward.slice(0, depth)
  ]
  return [...new Set(candidates)]
}

export type LocalTrail = {
  readonly slugs: readonly string[]
  readonly cursor: number
}

export const emptyTrail: LocalTrail = { slugs: [], cursor: -1 }

const boundTrail = (slugs: readonly string[]): readonly string[] =>
  slugs.length > TRAIL_CAPACITY ? slugs.slice(slugs.length - TRAIL_CAPACITY) : slugs

export const visitSlug = (trail: LocalTrail, slug: string): LocalTrail => {
  const existing = trail.slugs.indexOf(slug)
  if (existing >= 0) return { slugs: trail.slugs, cursor: existing }

  const truncated = trail.cursor < 0 ? [] : trail.slugs.slice(0, trail.cursor + 1)
  const slugs = boundTrail([...truncated, slug])
  return { slugs, cursor: slugs.length - 1 }
}

export type TrailNeighbours = {
  readonly back: string | undefined
  readonly forward: string | undefined
}

export const trailNeighbours = (trail: LocalTrail): TrailNeighbours => {
  if (trail.cursor < 0) return { back: undefined, forward: undefined }
  return {
    back: trail.cursor > 0 ? trail.slugs[trail.cursor - 1] : undefined,
    forward: trail.cursor < trail.slugs.length - 1 ? trail.slugs[trail.cursor + 1] : undefined
  }
}

export const localDestinationFor = (
  trail: LocalTrail,
  slug: string,
  step: Step
): string | undefined => {
  if (trail.slugs[trail.cursor] !== slug) return undefined
  return step === 'back' ? trailNeighbours(trail).back : trailNeighbours(trail).forward
}

export const mergeNeighbourhoodIntoTrail = (
  trail: LocalTrail,
  slug: string,
  neighbourhood: Neighbourhood
): LocalTrail => {
  const anchored = visitSlug(trail, slug)
  const cursor = anchored.cursor
  const before = anchored.slugs.slice(0, cursor)
  const after = anchored.slugs.slice(cursor + 1)

  const backFill = neighbourhood.back
    .toReversed()
    .filter((candidate) => !anchored.slugs.includes(candidate))
  const forwardFill = neighbourhood.forward.filter(
    (candidate) => !anchored.slugs.includes(candidate)
  )

  const slugs = boundTrail([
    ...before,
    ...(before.length === 0 ? backFill : []),
    slug,
    ...after,
    ...(after.length === 0 ? forwardFill : [])
  ])

  return { slugs, cursor: slugs.indexOf(slug) }
}
