import { describe, expect, it } from 'vitest'
import type { SubmitRecordInput } from './-program'
import { buildRecordPayload } from './-payload'

const input: SubmitRecordInput = {
  userId: 'user-1',
  formData: {
    title: 'Draft mix',
    description: 'Late-night selections',
    slug: 'draft-mix',
    content: '# Notes',
    thumbnailUrl: '',
    tags: ['ambient'],
    tracklist: [{ id: 1, title: 'Opening Track', time: 30 }],
    draft: true,
    creatorId: 'current',
    showId: 'show-1',
    episodeNumber: '12'
  },
  imageUrl: 'https://example.com/image.jpg',
  audioUrl: 'https://example.com/audio.mp3',
  isEditMode: false,
  editSlug: '',
  editType: 'mix'
}

describe('buildRecordPayload', () => {
  it('projects a mix form into draft and published API payloads', () => {
    expect(buildRecordPayload(input)).toEqual({
      title: 'Draft mix',
      description: 'Late-night selections',
      slug: 'draft-mix',
      content: '# Notes\n\n## Tracklist\n1. Opening Track (0:30)',
      thumbnailUrl: 'https://example.com/image.jpg',
      url: 'https://example.com/audio.mp3',
      type: 'mix',
      draft: true,
      tags: ['ambient'],
      creatorIds: ['user-1'],
      showId: 'show-1',
      episodeNumber: 12
    })

    expect(
      buildRecordPayload({
        ...input,
        formData: {
          ...input.formData,
          title: 'Published Mix',
          slug: '',
          tracklist: [],
          draft: false,
          creatorId: 'dj-2',
          episodeNumber: ''
        }
      })
    ).toMatchObject({
      slug: 'published-mix',
      content: '# Notes',
      draft: false,
      creatorIds: ['dj-2']
    })
  })
})
