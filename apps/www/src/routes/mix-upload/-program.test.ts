import { describe, expect, it } from 'vitest'
import type { SubmitRecordInput } from './-program'
import { buildRecordPayload } from './-payload'

const input: SubmitRecordInput = {
  userId: 'user-1',
  formData: {
    title: 'Draft mix',
    description: '',
    slug: 'draft-mix',
    content: '',
    thumbnailUrl: '',
    tags: [],
    tracklist: [],
    draft: true
  },
  imageUrl: 'https://example.com/image.jpg',
  audioUrl: 'https://example.com/audio.mp3',
  isEditMode: false,
  editSlug: '',
  editType: 'mix'
}

describe('buildRecordPayload', () => {
  it('projects Save Draft state into the API payload', () => {
    expect(buildRecordPayload(input)).toMatchObject({ draft: true })
    expect(
      buildRecordPayload({ ...input, formData: { ...input.formData, draft: false } })
    ).toMatchObject({ draft: false })
  })
})
