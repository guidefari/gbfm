import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { MixJobRecord } from './types'

export function getDefaultMixJobsDir(): string {
  return path.join(os.homedir(), 'Library/Application Support/gbfm/mix-jobs')
}

export function toSafeMixTitle(title: string): string {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
}

export async function ensureMixJobsDir(jobsDir = getDefaultMixJobsDir()) {
  await Promise.all([
    fs.mkdir(jobsDir, { recursive: true }),
    fs.mkdir(path.join(jobsDir, 'outputs'), { recursive: true }),
    fs.mkdir(path.join(jobsDir, 'logs'), { recursive: true })
  ])
}

export function getMixJobFilePath(jobId: string, jobsDir = getDefaultMixJobsDir()) {
  return path.join(jobsDir, `${jobId}.json`)
}

export function getMixJobOutputPath(
  title: string,
  outputFormat: 'mp3' | 'mp4',
  jobsDir = getDefaultMixJobsDir()
) {
  return path.join(jobsDir, 'outputs', `${toSafeMixTitle(title)}.${outputFormat}`)
}

export function getMixJobLogPaths(jobId: string, jobsDir = getDefaultMixJobsDir()) {
  return {
    stdoutLogPath: path.join(jobsDir, 'logs', `${jobId}.stdout.log`),
    stderrLogPath: path.join(jobsDir, 'logs', `${jobId}.stderr.log`)
  }
}

export async function writeMixJob(job: MixJobRecord) {
  await fs.writeFile(getMixJobFilePath(job.id), JSON.stringify(job, null, 2))
}

export async function readMixJob(jobFilePath: string): Promise<MixJobRecord> {
  const raw = await fs.readFile(jobFilePath, 'utf8')
  return JSON.parse(raw) as MixJobRecord
}

export async function listMixJobs(jobsDir = getDefaultMixJobsDir()) {
  await ensureMixJobsDir(jobsDir)
  const entries = await fs.readdir(jobsDir)
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => readMixJob(path.join(jobsDir, entry)))
  )

  return jobs.sort((a, b) => b.updatedAt - a.updatedAt)
}
