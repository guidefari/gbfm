import { Effect, Option, Stream } from 'effect'

type TrackPage<A> = {
  readonly items: ReadonlyArray<A>
  readonly next: string | null
  readonly offset: number
  readonly limit: number
}

export const collectSpotifyTrackPages = <A, E, R>(
  initialPage: TrackPage<A>,
  loadPage: (options: { offset: number; limit: number }) => Effect.Effect<TrackPage<A>, E, R>
): Effect.Effect<A[], E, R> => {
  type PageEffect = Effect.Effect<TrackPage<A>, E, R>

  return Stream.paginate<PageEffect, A, E, R>(Effect.succeed(initialPage), (pageEffect) =>
    pageEffect.pipe(
      Effect.map((page): readonly [ReadonlyArray<A>, Option.Option<PageEffect>] => [
        page.items,
        page.next === null
          ? Option.none()
          : Option.some(loadPage({ offset: page.offset + page.limit, limit: 50 }))
      ])
    )
  ).pipe(Stream.runCollect)
}
