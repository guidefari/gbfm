import { listMixJobs, type MixJobRecord } from '@gbfm/core/mix-processing'
import { Action, ActionPanel, Clipboard, Icon, List, open, showToast, Toast } from '@raycast/api'
import { useEffect, useState } from 'react'

function getStatusIcon(job: MixJobRecord) {
  switch (job.status) {
    case 'queued':
      return Icon.Clock
    case 'processing':
      return Icon.Gear
    case 'completed':
      return Icon.CheckCircle
    case 'failed':
      return Icon.XMarkCircle
  }
}

function getStatusColor(job: MixJobRecord) {
  switch (job.status) {
    case 'queued':
      return '#f59e0b'
    case 'processing':
      return '#3b82f6'
    case 'completed':
      return '#10b981'
    case 'failed':
      return '#ef4444'
  }
}

export default function MixJobs() {
  const [jobs, setJobs] = useState<MixJobRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadJobs = async () => {
    setIsLoading(true)

    try {
      setJobs(await listMixJobs())
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to load jobs',
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [])

  return (
    <List isLoading={isLoading} searchBarPlaceholder='Search mix jobs...'>
      {jobs.map((job) => (
        <List.Item
          key={job.id}
          icon={{ source: getStatusIcon(job), tintColor: getStatusColor(job) }}
          title={job.title}
          subtitle={job.outputPath}
          accessories={[{ text: job.outputFormat.toUpperCase() }, { text: job.status }]}
          actions={
            <ActionPanel>
              <Action title='Refresh Jobs' onAction={loadJobs} icon={Icon.ArrowClockwise} />
              {job.status === 'completed' ? (
                <Action
                  title='Open Output'
                  icon={Icon.Play}
                  onAction={() => open(job.outputPath)}
                />
              ) : null}
              <Action
                title='Open Stdout Log'
                icon={Icon.Document}
                onAction={() => open(job.stdoutLogPath)}
              />
              <Action
                title='Open Stderr Log'
                icon={Icon.ExclamationMark}
                onAction={() => open(job.stderrLogPath)}
              />
              <Action
                title='Copy Output Path'
                icon={Icon.Clipboard}
                onAction={() => Clipboard.copy(job.outputPath)}
              />
              {job.error ? (
                <Action
                  title='Copy Error'
                  icon={Icon.Bug}
                  onAction={() => Clipboard.copy(job.error ?? '')}
                />
              ) : null}
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}
