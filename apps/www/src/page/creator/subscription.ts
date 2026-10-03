import { Effect, Stream } from 'effect'
import { Subscription } from 'foldkit'

import { Message } from './message'
import type { Model } from './model'
import { CreatorUpload } from './upload/runtime'

export const subscriptions = Subscription.make<Model, Message, CreatorUpload>()(() => ({
  uploadProgress: Subscription.persistent(
    Stream.unwrap(
      CreatorUpload.pipe(
        Effect.map((service) =>
          service.progress.pipe(
            Stream.map((progress) =>
              Message.UploadProgressed({
                percent:
                  progress.totalBytes === 0
                    ? 0
                    : Math.floor((progress.bytesUploaded / progress.totalBytes) * 100),
              }),
            ),
          ),
        ),
      ),
    ),
  ),
}))
