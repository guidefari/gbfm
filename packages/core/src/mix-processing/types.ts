export interface ProcessedFiles {
  audioPath: string
  imagePath: string
  outputPath: string
  description: string
  artist?: string
  album?: string
}

export interface MixProcessingInput {
  audioBuffer: Buffer
  imageBuffer: Buffer
  outputFormat: 'mp3' | 'mp4'
  title: string
  description: string
  artist?: string
  album?: string
}

export type JobStatus =
  | { readonly _tag: 'Queued' }
  | { readonly _tag: 'Processing' }
  | { readonly _tag: 'Completed'; readonly outputUrl: string }
  | { readonly _tag: 'Failed'; readonly error: string }

export interface JobInfo {
  readonly id: string
  readonly status: JobStatus
  readonly createdAt: number
  readonly updatedAt: number
}

export type MixJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface MixJobRecord {
  id: string
  title: string
  outputFormat: 'mp3' | 'mp4'
  status: MixJobStatus
  createdAt: number
  updatedAt: number
  outputPath: string
  stdoutLogPath: string
  stderrLogPath: string
  audioPath: string
  imagePath: string
  artist?: string
  album?: string
  pid?: number
  error?: string
}
