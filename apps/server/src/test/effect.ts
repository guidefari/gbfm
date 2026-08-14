import { Effect, Layer } from 'effect'

export const withTestLayer = <A, E, ROut, E2, RIn>(
  effect: Effect.Effect<A, E, ROut>,
  layer: Layer.Layer<ROut, E2, RIn>
) =>
  Effect.scoped(
    Layer.build(layer).pipe(Effect.flatMap((context) => Effect.provide(effect, context)))
  )
