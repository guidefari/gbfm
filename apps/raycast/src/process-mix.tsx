import {
  Action,
  ActionPanel,
  Detail,
  Form,
  LocalStorage,
  showHUD,
  showToast,
  Toast
} from '@raycast/api'
import { useEffect, useRef, useState } from 'react'
import { authenticatedFetch, parseJsonResponse } from './api-client'

interface JobStatus {
  id: string
  status:
    | { _tag: 'Queued' }
    | { _tag: 'Processing' }
    | { _tag: 'Completed'; outputUrl: string }
    | { _tag: 'Failed'; error: string }
  createdAt: number
  updatedAt: number
}

export default function ProcessMix() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!jobId) return

    const pollStatus = async () => {
      try {
        const response = await authenticatedFetch(
          `/content/mixes/jobs/${jobId}`
        )
        if (response.ok) {
          const status = await parseJsonResponse<JobStatus>(response)
          setJobStatus(status)

          if (status.status._tag === 'Completed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            await showHUD(`✅ Mix processed! ${status.status.outputUrl}`)
          } else if (status.status._tag === 'Failed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            await showToast({
              style: Toast.Style.Failure,
              title: 'Processing Failed',
              message: status.status.error
            })
          }
        }
      } catch {
        // Ignore polling errors, will retry
      }
    }

    pollingRef.current = setInterval(pollStatus, 3000)
    pollStatus()

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [jobId])

  if (jobId && jobStatus) {
    const statusText =
      jobStatus.status._tag === 'Queued'
        ? '⏳ Queued for processing...'
        : jobStatus.status._tag === 'Processing'
          ? '🔄 Processing with FFmpeg...'
          : jobStatus.status._tag === 'Completed'
            ? `✅ Complete!\n\n${jobStatus.status.outputUrl}`
            : `❌ Failed: ${jobStatus.status.error}`

    const markdown = `# Mix Processing\n\n**Job ID:** ${jobId}\n\n**Status:** ${statusText}\n\n_Polling every 3 seconds..._`

    return (
      <Detail
        markdown={markdown}
        actions={
          <ActionPanel>
            {jobStatus.status._tag === 'Completed' && (
              <Action.OpenInBrowser
                title='Open Output'
                url={jobStatus.status.outputUrl}
              />
            )}
            <Action
              title='Process Another'
              onAction={() => {
                setJobId(null)
                setJobStatus(null)
              }}
            />
          </ActionPanel>
        }
      />
    )
  }

  const handleSubmit = async (values: {
    audioFile: string[]
    coverImage: string[]
    title: string
    artist: string
    album: string
    description: string
    outputFormat: string
  }) => {
    if (!values.audioFile?.[0] || !values.coverImage?.[0]) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Missing Files',
        message: 'Please select both an audio file and a cover image'
      })
      return
    }

    setIsSubmitting(true)

    try {
      const fs = await import('node:fs/promises')
      const audioBuffer = await fs.readFile(values.audioFile[0])
      const imageBuffer = await fs.readFile(values.coverImage[0])

      const formData = new FormData()
      formData.append('title', values.title)
      if (values.artist) formData.append('artist', values.artist)
      if (values.album) formData.append('album', values.album)
      formData.append('description', values.description || '')
      formData.append('outputFormat', values.outputFormat || 'mp3')

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' })
      formData.append(
        'audioFile',
        audioBlob,
        values.audioFile[0].split('/').pop() || 'audio.mp3'
      )
      formData.append(
        'coverImage',
        imageBlob,
        values.coverImage[0].split('/').pop() || 'cover.jpg'
      )

      const baseUrl = await LocalStorage.getItem<string>('gbfm-base-url')
      const accessToken =
        await LocalStorage.getItem<string>('gbfm-access-token')

      if (!baseUrl || !accessToken) {
        throw new Error(
          'API configuration missing. Please configure and sign in first.'
        )
      }

      const response = await fetch(`${baseUrl}/content/mixes/process/async`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const error = (await response
          .json()
          .catch(() => ({ error: 'Upload failed' }))) as { error: string }
        throw new Error(error.error)
      }

      const result = (await response.json()) as {
        jobId: string
        status: string
      }

      setJobId(result.jobId)
      await showToast({
        style: Toast.Style.Success,
        title: 'Processing Queued',
        message: `Job ${result.jobId.slice(0, 8)}... submitted`
      })
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Failed to upload mix'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title='Process Mix' onSubmit={handleSubmit} />
        </ActionPanel>
      }
      isLoading={isSubmitting}>
      <Form.FilePicker
        id='audioFile'
        title='Audio File'
        allowMultipleSelection={false}
        canChooseDirectories={false}
      />

      <Form.FilePicker
        id='coverImage'
        title='Cover Image'
        allowMultipleSelection={false}
        canChooseDirectories={false}
      />

      <Form.TextField id='title' title='Title' placeholder='Mix title' />

      <Form.TextField
        id='artist'
        title='Artist'
        placeholder='Artist name (optional)'
      />

      <Form.TextField
        id='album'
        title='Album'
        placeholder='Album name (optional, defaults to GBFM)'
      />

      <Form.TextArea
        id='description'
        title='Tracklist'
        placeholder='Paste tracklist here'
      />

      <Form.Dropdown id='outputFormat' title='Output Format' defaultValue='mp3'>
        <Form.Dropdown.Item value='mp3' title='MP3 (Audio only)' />
        <Form.Dropdown.Item value='mp4' title='MP4 (Video with still image)' />
      </Form.Dropdown>
    </Form>
  )
}
