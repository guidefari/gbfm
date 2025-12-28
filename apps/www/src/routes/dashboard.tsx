import { createFileRoute, redirect } from '@tanstack/react-router'
import { useId, useRef } from 'react'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/auth/sign-in'
      })
    }
  },
  component: Dashboard
})

function Dashboard() {
  const formRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const artistId = useId()
  const albumId = useId()
  const descriptionId = useId()
  const audioFileId = useId()
  const coverImageId = useId()
  const outputFormatId = useId()

  return (
    <div className='p-4 mx-auto max-w-xl'>
      <h1 className='mb-4 text-2xl font-bold'>Upload New Mix</h1>
      <form
        ref={formRef}
        action='/api/mix/process'
        method='post'
        encType='multipart/form-data'
        className='space-y-4'>
        <div>
          <label htmlFor={titleId} className='block mb-1 font-medium'>
            Mix Title
          </label>
          <input
            type='text'
            id={titleId}
            name='title'
            required
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor={artistId} className='block mb-1 font-medium'>
            Artist Name (optional)
          </label>
          <input
            type='text'
            id={artistId}
            name='artist'
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor={albumId} className='block mb-1 font-medium'>
            Album Name (optional)
          </label>
          <input
            type='text'
            id={albumId}
            name='album'
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor={descriptionId} className='block mb-1 font-medium'>
            Description
          </label>
          <textarea
            id={descriptionId}
            name='description'
            rows={4}
            required
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor={audioFileId} className='block mb-1 font-medium'>
            Audio File
          </label>
          <input
            type='file'
            id={audioFileId}
            name='audioFile'
            accept='audio/*'
            required
            className='w-full'
          />
        </div>
        <div>
          <label htmlFor={coverImageId} className='block mb-1 font-medium'>
            Cover Image
          </label>
          <input
            type='file'
            id={coverImageId}
            name='coverImage'
            accept='image/*'
            required
            className='w-full'
          />
        </div>
        <div>
          <label htmlFor={outputFormatId} className='block mb-1 font-medium'>
            Output Format
          </label>
          <select
            id={outputFormatId}
            name='outputFormat'
            required
            className='p-2 w-full rounded border'>
            <option value='mp4'>MP4 Video</option>
            <option value='mp3'>MP3 Audio</option>
          </select>
        </div>
        <button
          type='submit'
          className='px-4 py-2 text-white bg-blue-600 rounded'>
          Upload Mix
        </button>
      </form>
    </div>
  )
}
