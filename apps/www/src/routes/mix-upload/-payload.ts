import { formatTime, generateSlug } from '@gbfm/ui'
import type { SubmitRecordInput } from './-program'

export const buildRecordPayload = (input: SubmitRecordInput) => {
  const tracklistMarkdown =
    input.formData.tracklist.length > 0
      ? `\n\n## Tracklist\n${input.formData.tracklist
          .map((track, index) => `${index + 1}. ${track.title} (${formatTime(track.time)})`)
          .join('\n')}`
      : ''

  const payload = {
    title: input.formData.title,
    description: input.formData.description,
    slug: input.formData.slug || generateSlug(input.formData.title),
    content: input.formData.content + tracklistMarkdown,
    thumbnailUrl: input.imageUrl,
    url: input.audioUrl,
    type: 'mix',
    draft: input.formData.draft,
    tags: input.formData.tags,
    creatorIds: [
      input.formData.creatorId === 'current'
        ? input.userId
        : input.formData.creatorId || input.userId
    ].filter(Boolean),
    showId: input.formData.showId
  }

  return input.formData.episodeNumber
    ? { ...payload, episodeNumber: Number(input.formData.episodeNumber) }
    : payload
}
