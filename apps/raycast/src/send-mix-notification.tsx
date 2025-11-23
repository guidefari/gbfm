import {
  Action,
  ActionPanel,
  Form,
  Icon,
  popToRoot,
  showToast,
  Toast
} from '@raycast/api'
import { Effect, Runtime } from 'effect'
import { useEffect, useState } from 'react'
import { get, parseJsonResponse, post } from './api-client'

interface Mix {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  createdAt: string
}

interface MixNotificationFormData {
  mixSlug: string
  recipients: string
  customUsername: string
  customTitle: string
  customArtist: string
  customCoverImageUrl: string
  customReleaseDate: string
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export default function SendMixNotification() {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [isLoadingMixes, setIsLoadingMixes] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<MixNotificationFormData>({
    mixSlug: '',
    recipients: '',
    customUsername: '',
    customTitle: '',
    customArtist: '',
    customCoverImageUrl: '',
    customReleaseDate: ''
  })

  useEffect(() => {
    const loadMixes = async () => {
      const loadMixesEffect = Effect.gen(function* () {
        yield* Effect.logInfo('Loading mixes for notification')

        const response = yield* Effect.promise(() => get('/content/audio/mix'))

        const paginatedResponse = yield* Effect.promise(() =>
          parseJsonResponse<PaginatedResponse<Mix>>(response)
        )

        yield* Effect.logInfo(`Loaded ${paginatedResponse.data.length} mixes`)

        return paginatedResponse.data
      })

      try {
        const mixList = await Runtime.runPromise(Runtime.defaultRuntime)(
          loadMixesEffect
        )
        setMixes(mixList)
      } catch (error) {
        await Runtime.runPromise(Runtime.defaultRuntime)(
          Effect.logError('Failed to load mixes', {
            error: error instanceof Error ? error.message : String(error)
          })
        )

        await showToast({
          style: Toast.Style.Failure,
          title: 'Error',
          message: 'Failed to load mixes'
        })
      } finally {
        setIsLoadingMixes(false)
      }
    }

    loadMixes()
  }, [])

  const handleSubmit = async (values: MixNotificationFormData) => {
    setIsSubmitting(true)

    const sendNotificationEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Sending mix notification', {
        mixSlug: values.mixSlug,
        recipientCount: values.recipients.split(',').length
      })

      const recipients = values.recipients
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0)

      if (recipients.length === 0) {
        throw new Error('Please provide at least one recipient email address')
      }

      const metadata: Record<string, string> = {}
      if (values.customUsername) metadata.username = values.customUsername
      if (values.customTitle) metadata.mixTitle = values.customTitle
      if (values.customArtist) metadata.artistName = values.customArtist
      if (values.customCoverImageUrl)
        metadata.coverImageUrl = values.customCoverImageUrl
      if (values.customReleaseDate)
        metadata.releaseDate = values.customReleaseDate

      const requestBody = {
        mixSlug: values.mixSlug,
        recipients,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }

      yield* Effect.logDebug('Request payload', requestBody)

      const response = yield* Effect.promise(() =>
        post('/email/send-mix-notification', requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<{
          success: boolean
          sentTo: string[]
          emailIds: string[]
          message: string
        }>(response)
      )

      yield* Effect.logInfo('Mix notification sent', {
        sentTo: result.sentTo,
        emailCount: result.emailIds.length
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Sent!',
          message: result.message
        })
      )

      return result
    })

    try {
      await Runtime.runPromise(Runtime.defaultRuntime)(sendNotificationEffect)
      popToRoot()
    } catch (error) {
      await Runtime.runPromise(Runtime.defaultRuntime)(
        Effect.logError('Mix notification failed', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to send notification'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedMix = mixes.find((mix) => mix.slug === formData.mixSlug)

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Send Notification'
            onSubmit={handleSubmit}
            icon={Icon.Envelope}
          />
        </ActionPanel>
      }
      isLoading={isLoadingMixes || isSubmitting}>
      <Form.Dropdown
        id='mixSlug'
        title='Select Mix'
        value={formData.mixSlug}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, mixSlug: value }))
        }
        storeValue>
        {mixes.map((mix) => (
          <Form.Dropdown.Item
            key={mix.id}
            value={mix.slug}
            title={mix.title}
            icon={Icon.Music}
          />
        ))}
      </Form.Dropdown>

      {selectedMix && (
        <Form.Description
          title='Preview'
          text={`${selectedMix.title} - Created: ${new Date(selectedMix.createdAt).toLocaleDateString()}`}
        />
      )}

      <Form.TextArea
        id='recipients'
        title='Recipients'
        placeholder='email1@example.com, email2@example.com'
        value={formData.recipients}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, recipients: value }))
        }
        info='Comma-separated list of email addresses'
      />

      <Form.Separator />

      <Form.Description
        title='Customize Email'
        text='Optional: Override default mix metadata for this email'
      />

      <Form.TextField
        id='customUsername'
        title='Recipient Name'
        placeholder='e.g., abstractrhythmrecords'
        value={formData.customUsername}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, customUsername: value }))
        }
        info='Personalized greeting name (defaults to email username)'
      />

      <Form.TextField
        id='customTitle'
        title='Mix Title'
        placeholder={selectedMix?.title || 'e.g., gb#63'}
        value={formData.customTitle}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, customTitle: value }))
        }
        info='Override the mix title in the email'
      />

      <Form.TextField
        id='customArtist'
        title='Artist Name'
        placeholder='e.g., Guide Fari'
        value={formData.customArtist}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, customArtist: value }))
        }
        info='Override the artist name'
      />

      <Form.TextField
        id='customCoverImageUrl'
        title='Cover Image URL'
        placeholder={selectedMix?.thumbnailUrl || 'https://...'}
        value={formData.customCoverImageUrl}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, customCoverImageUrl: value }))
        }
        info='Override the cover image'
      />

      <Form.TextField
        id='customReleaseDate'
        title='Release Date'
        placeholder='e.g., January 15, 2025'
        value={formData.customReleaseDate}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, customReleaseDate: value }))
        }
        info='Override the release date text'
      />
    </Form>
  )
}
