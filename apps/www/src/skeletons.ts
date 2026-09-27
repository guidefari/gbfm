import { Match } from 'effect'
import { inertHtml as h } from 'foldkit/html'

import { Route } from './application'

const block = (className: string) => h.div([h.Class(className)], [])

const repeat = <A>(count: number, render: (index: number) => A) =>
  Array.from({ length: count }, (_, index) => render(index))

const loading = (className: string, children: ReadonlyArray<ReturnType<typeof block>>) =>
  h.div([h.Class(className), h.Role('status'), h.AriaLabel('Loading content')], [...children])

export const editorialSkeleton = () =>
  loading('max-w-2xl mx-auto px-4 py-8', [
    h.div(
      [h.Class('animate-pulse space-y-3')],
      repeat(5, (index) =>
        h.div(
          [
            h.Key(String(index)),
            h.Class('flex gap-3 items-start border border-border bg-card p-3 sm:p-4'),
          ],
          [
            block('h-16 w-16 sm:h-20 sm:w-20 shrink-0 bg-muted/60'),
            h.div(
              [h.Class('flex-1 min-w-0 space-y-2')],
              [
                block('h-2.5 w-8 rounded bg-muted/50'),
                block('h-5 w-full rounded bg-muted/60'),
                block('h-4 w-4/5 rounded bg-muted/60'),
                block('h-3 w-full rounded bg-muted/40'),
                block('h-3 w-2/3 rounded bg-muted/40'),
              ],
            ),
          ],
        ),
      ),
    ),
  ])

export const gridSkeleton = () =>
  loading('p-4', [
    h.div(
      [
        h.Class(
          'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        ),
      ],
      repeat(12, (index) =>
        h.div(
          [h.Key(String(index)), h.Class('flex flex-col gap-2')],
          [
            block('w-full rounded-sm aspect-square bg-muted/50 animate-pulse'),
            block('h-4 rounded bg-muted/50 animate-pulse'),
          ],
        ),
      ),
    ),
  ])

export const tagsSkeleton = () =>
  loading('max-w-3xl mx-auto px-4 py-8', [
    h.div(
      [h.Class('flex flex-wrap gap-2')],
      repeat(12, (index) =>
        h.div([h.Key(String(index)), h.Class('h-7 w-20 animate-pulse rounded-sm bg-muted/50')], []),
      ),
    ),
  ])

export const postsSkeleton = () =>
  loading('max-w-3xl mx-auto px-4 py-8', [
    h.div(
      [h.Class('animate-pulse space-y-2')],
      repeat(4, (index) =>
        h.div(
          [
            h.Key(String(index)),
            h.Class('space-y-2 rounded-lg border border-border/40 bg-card/40 p-3'),
          ],
          [block('h-3 w-24 rounded-full bg-muted'), block('h-3 w-2/3 rounded-full bg-muted')],
        ),
      ),
    ),
  ])

export const tweetSkeleton = () =>
  loading('max-w-3xl px-4 py-8 mx-auto', [
    h.div(
      [
        h.Class(
          'animate-pulse space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5',
        ),
      ],
      [
        h.div(
          [h.Class('flex items-center gap-3')],
          [
            block('h-10 w-10 rounded-sm bg-muted'),
            h.div(
              [h.Class('space-y-1.5')],
              [block('h-3 w-24 rounded-full bg-muted'), block('h-2.5 w-16 rounded-full bg-muted')],
            ),
          ],
        ),
        block('h-4 w-full rounded-full bg-muted'),
        block('h-4 w-3/4 rounded-full bg-muted'),
        h.div(
          [h.Class('flex gap-4 rounded-md border border-border/50 bg-muted/20 p-4')],
          [
            block('size-24 shrink-0 rounded-sm bg-muted sm:size-32'),
            h.div(
              [h.Class('flex-1 space-y-3 py-2')],
              [
                block('h-3 w-16 rounded bg-muted'),
                block('h-5 w-2/3 rounded bg-muted'),
                block('h-3 w-1/3 rounded bg-muted'),
              ],
            ),
          ],
        ),
      ],
    ),
  ])

export const profileSkeleton = () =>
  loading('flex flex-col lg:flex-row lg:items-start lg:gap-6 lg:p-6', [
    h.aside(
      [h.Class('w-full shrink-0 p-4 lg:w-80 lg:p-0')],
      [
        h.div(
          [h.Class('flex items-start gap-4')],
          [
            block('h-24 w-24 shrink-0 animate-pulse rounded-sm bg-muted'),
            h.div(
              [h.Class('flex flex-col gap-2')],
              [
                block('h-6 w-32 animate-pulse rounded bg-muted'),
                block('h-4 w-24 animate-pulse rounded bg-muted'),
                block('h-3 w-36 animate-pulse rounded bg-muted'),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('mt-6 flex flex-col gap-2')],
          [
            block('h-4 w-16 animate-pulse rounded bg-muted'),
            block('h-3 w-full animate-pulse rounded bg-muted'),
            block('h-3 w-full animate-pulse rounded bg-muted'),
            block('h-3 w-3/4 animate-pulse rounded bg-muted'),
          ],
        ),
      ],
    ),
    h.div(
      [h.Class('min-w-0 flex-1 space-y-8 px-4 py-4 lg:px-0 lg:py-0')],
      repeat(3, (index) =>
        h.div(
          [h.Key(String(index)), h.Class('space-y-3')],
          [
            block('h-5 w-24 animate-pulse rounded bg-muted'),
            h.div(
              [h.Class('flex gap-4')],
              repeat(3, (inner) =>
                h.div(
                  [
                    h.Key(String(inner)),
                    h.Class('h-36 w-36 shrink-0 animate-pulse rounded-sm bg-muted'),
                  ],
                  [],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  ])

export const episodesSkeleton = () =>
  loading('max-w-3xl mx-auto px-4 py-8 space-y-3', [
    ...repeat(6, (index) =>
      h.div(
        [h.Key(String(index)), h.Class('flex items-center gap-3')],
        [
          block('size-4 shrink-0 rounded bg-muted/50 animate-pulse'),
          h.div(
            [h.Class('flex-1 space-y-2')],
            [
              block('h-4 w-3/4 rounded bg-muted/50 animate-pulse'),
              block('h-3 w-1/3 rounded bg-muted/50 animate-pulse'),
            ],
          ),
        ],
      ),
    ),
  ])

export const detailSkeleton = () =>
  loading('max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-6', [
    h.div(
      [h.Class('flex flex-col gap-6 sm:flex-row sm:items-end')],
      [
        block('aspect-square w-60 shrink-0 rounded-sm bg-muted'),
        h.div(
          [h.Class('flex-1 space-y-3')],
          [block('h-8 w-3/4 rounded bg-muted'), block('h-4 w-1/3 rounded bg-muted')],
        ),
      ],
    ),
    h.div(
      [h.Class('space-y-2')],
      [
        block('h-3 w-full rounded bg-muted/60'),
        block('h-3 w-full rounded bg-muted/60'),
        block('h-3 w-2/3 rounded bg-muted/60'),
      ],
    ),
  ])

const listingSkeleton = (kind: string) =>
  Match.value(kind).pipe(
    Match.when('editorial', editorialSkeleton),
    Match.when('tweets', tweetSkeleton),
    Match.when('tags', tagsSkeleton),
    Match.when('shows', episodesSkeleton),
    Match.orElse(gridSkeleton),
  )

const detailSkeletonFor = (kind: string) =>
  Match.value(kind).pipe(
    Match.when('tweets', tweetSkeleton),
    Match.when('profile', profileSkeleton),
    Match.when('tags', postsSkeleton),
    Match.when('shows', episodesSkeleton),
    Match.orElse(detailSkeleton),
  )

const isTweet = (route: Route) => Route.guards.Detail(route) && route.kind === 'tweets'

/** Tweet to tweet keeps the current tweet on screen, matching prod's in-place tweet navigation. */
export const pageSkeleton = (target: Route, current: Route) =>
  isTweet(target) && isTweet(current)
    ? null
    : Match.value(target).pipe(
        Match.tag('Listing', ({ kind }) => listingSkeleton(kind)),
        Match.tag('Detail', ({ kind }) => detailSkeletonFor(kind)),
        Match.orElse(() => null),
      )
