import { Effect } from 'effect'
import type { MusicEntityReference } from '@/components/editor/music-entity/music-entity-markdown'

export type MusicEntityResolution =
  | {
      readonly status: 'resolved'
      readonly url: string
      readonly reference: MusicEntityReference
    }
  | {
      readonly status: 'failed'
      readonly url: string
    }

export type ResolveMusicEntity<E> = (url: string) => Effect.Effect<MusicEntityReference, E>

export const resolveMusicEntityBatchEffect = <E>(
  urls: ReadonlyArray<string>,
  resolve: ResolveMusicEntity<E>
): Effect.Effect<ReadonlyArray<MusicEntityResolution>> =>
  Effect.forEach(
    Array.from(new Set(urls)),
    (url) =>
      resolve(url).pipe(
        Effect.match({
          onFailure: (): MusicEntityResolution => ({ status: 'failed', url }),
          onSuccess: (reference): MusicEntityResolution => ({
            status: 'resolved',
            url,
            reference
          })
        })
      ),
    { concurrency: 3 }
  )
