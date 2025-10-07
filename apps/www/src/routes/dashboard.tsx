import { createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'
import { useAuthStore } from '@/store/auth'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard
})

function Dashboard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const formRef = useRef<HTMLFormElement>(null)

  if (!isAuthenticated) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen'>
        <h2 className='mb-4 text-xl font-bold'>
          Please sign in to access the dashboard.
        </h2>
        <a href='/auth/sign-in' className='text-blue-600 underline'>
          Go to Sign In
        </a>
      </div>
    )
  }

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
          <label htmlFor='title' className='block mb-1 font-medium'>
            Mix Title
          </label>
          <input
            type='text'
            id='title'
            name='title'
            required
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor='artist' className='block mb-1 font-medium'>
            Artist Name (optional)
          </label>
          <input
            type='text'
            id='artist'
            name='artist'
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor='album' className='block mb-1 font-medium'>
            Album Name (optional)
          </label>
          <input
            type='text'
            id='album'
            name='album'
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor='description' className='block mb-1 font-medium'>
            Description
          </label>
          <textarea
            id='description'
            name='description'
            rows={4}
            required
            className='p-2 w-full rounded border'
          />
        </div>
        <div>
          <label htmlFor='audioFile' className='block mb-1 font-medium'>
            Audio File
          </label>
          <input
            type='file'
            id='audioFile'
            name='audioFile'
            accept='audio/*'
            required
            className='w-full'
          />
        </div>
        <div>
          <label htmlFor='coverImage' className='block mb-1 font-medium'>
            Cover Image
          </label>
          <input
            type='file'
            id='coverImage'
            name='coverImage'
            accept='image/*'
            required
            className='w-full'
          />
        </div>
        <div>
          <label htmlFor='outputFormat' className='block mb-1 font-medium'>
            Output Format
          </label>
          <select
            id='outputFormat'
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
