import {
  ensureMixJobsDir,
  getDefaultMixJobsDir,
  getMixJobFilePath,
  getMixJobLogPaths,
  getMixJobOutputPath,
  writeMixJob
} from '@gbfm/core/mix-processing'
import { Action, ActionPanel, closeMainWindow, Form, showHUD, showToast, Toast } from '@raycast/api'
import { useState } from 'react'

async function findRepoRoot(path: typeof import('node:path')): Promise<string> {
  const { access, readFile } = await import('node:fs/promises')

  let dir = process.cwd()
  for (let i = 0; i < 20; i++) {
    try {
      const pkgPath = path.resolve(dir, 'package.json')
      await access(pkgPath)
      const content = await readFile(pkgPath, 'utf-8')
      if (JSON.parse(content).workspaces) return dir
    } catch {}

    const parent = path.resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }

  return process.cwd()
}

async function findBun(): Promise<string> {
  const knownLocations = [
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
    '/home/linuxbrew/.linuxbrew/bin/bun',
    ...(process.env.HOME ? [`${process.env.HOME}/.bun/bin/bun`] : [])
  ]

  try {
    const { access } = await import('node:fs/promises')
    for (const loc of knownLocations) {
      try {
        await access(loc)
        return loc
      } catch {}
    }
  } catch {}

  return 'bun'
}

export default function ProcessMix() {
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      const { spawn } = await import('node:child_process')
      const path = await import('node:path')
      const crypto = await import('node:crypto')
      const repoRoot = await findRepoRoot(path)
      const bunPath = await findBun()
      const jobId = crypto.randomUUID()
      const jobsDir = getDefaultMixJobsDir()
      const outputFormat = values.outputFormat === 'mp4' ? 'mp4' : 'mp3'

      await ensureMixJobsDir(jobsDir)

      const outputPath = getMixJobOutputPath(values.title, outputFormat, jobsDir)
      const jobFilePath = getMixJobFilePath(jobId, jobsDir)
      const { stdoutLogPath, stderrLogPath } = getMixJobLogPaths(jobId, jobsDir)
      const [stdoutHandle, stderrHandle] = await Promise.all([
        fs.open(stdoutLogPath, 'a'),
        fs.open(stderrLogPath, 'a')
      ])

      await writeMixJob({
        id: jobId,
        title: values.title,
        outputFormat,
        status: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        outputPath,
        stdoutLogPath,
        stderrLogPath,
        audioPath: values.audioFile[0],
        imagePath: values.coverImage[0],
        artist: values.artist || undefined,
        album: values.album || undefined
      })

      const args = [
        'run',
        'process-mix-job',
        '--job-file',
        jobFilePath,
        '--audio',
        values.audioFile[0],
        '--image',
        values.coverImage[0],
        '--title',
        values.title,
        '--description',
        values.description || '',
        '--format',
        outputFormat,
        '--output',
        outputPath
      ]

      if (values.artist) {
        args.push('--artist', values.artist)
      }

      if (values.album) {
        args.push('--album', values.album)
      }

      const child = spawn(bunPath, args, {
        cwd: repoRoot,
        detached: true,
        stdio: ['ignore', stdoutHandle.fd, stderrHandle.fd]
      })

      child.unref()
      await Promise.all([stdoutHandle.close(), stderrHandle.close()])

      await showToast({
        style: Toast.Style.Success,
        title: 'Processing Started',
        message: `Job ${jobId.slice(0, 8)} queued`
      })
      await closeMainWindow()
      await showHUD(`Mix queued: ${jobId.slice(0, 8)}`)
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Processing Failed',
        message: error instanceof Error ? error.message : 'Failed to process mix'
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

      <Form.TextField id='artist' title='Artist' placeholder='Artist name (optional)' />

      <Form.TextField
        id='album'
        title='Album'
        placeholder='Album name (optional, defaults to GBFM)'
      />

      <Form.TextArea id='description' title='Tracklist' placeholder='Paste tracklist here' />

      <Form.Dropdown id='outputFormat' title='Output Format' defaultValue='mp3'>
        <Form.Dropdown.Item value='mp3' title='MP3 (Audio only)' />
        <Form.Dropdown.Item value='mp4' title='MP4 (Video with still image)' />
      </Form.Dropdown>
    </Form>
  )
}
