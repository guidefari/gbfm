import {
  ActionPanel,
  Form,
  Action,
  showToast,
  Toast,
  LocalStorage,
  openExtensionPreferences
} from '@raycast/api'
import { useState, useEffect } from 'react'

interface SignInData {
  email: string
  password: string
  baseUrl: string
}

const BASE_URLS = [
  { id: 'localhost', title: 'Localhost', url: 'http://localhost:3003' },
  { id: 'production', title: 'Goosebumps.fm', url: 'https://api.goosebumps.fm' }
]

export default function SignIn() {
  const [formData, setFormData] = useState<SignInData>({
    email: '',
    password: '',
    baseUrl: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const baseUrl = await LocalStorage.getItem<string>('gbfm-base-url')
      setFormData((prev) => ({ ...prev, baseUrl: baseUrl || '' }))
    } catch (error) {
      console.error('Failed to load base URL:', error)
    } finally {
      setIsLoadingConfig(false)
    }
  }

  const handleSubmit = async (values: SignInData) => {
    if (!values.baseUrl) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Missing Base URL',
        message: 'Please select an environment first'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${values.baseUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password
        })
      })

      if (!response.ok) {
        const error = (await response.json()) as { error?: string }
        throw new Error(error.error || 'Sign in failed')
      }

      const result = (await response.json()) as {
        accessToken: string
        refreshToken: string
        user: { name?: string; email: string }
      }

      await Promise.all([
        LocalStorage.setItem('gbfm-base-url', values.baseUrl),
        LocalStorage.setItem('gbfm-access-token', result.accessToken),
        LocalStorage.setItem('gbfm-refresh-token', result.refreshToken),
        LocalStorage.setItem('gbfm-user', JSON.stringify(result.user))
      ])

      await showToast({
        style: Toast.Style.Success,
        title: 'Signed In Successfully',
        message: `Welcome back, ${result.user.name || result.user.email}!`
      })
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Sign In Failed',
        message: error instanceof Error ? error.message : 'Failed to sign in'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openApiConfig = async () => {
    openExtensionPreferences()
  }

  if (isLoadingConfig) {
    return <Form isLoading={true} />
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Sign In'
            onSubmit={handleSubmit}
            icon='🔑'
          />
          <Action
            title='Configure API'
            onAction={openApiConfig}
            icon='⚙️'
            shortcut={{ modifiers: ['cmd'], key: ',' }}
          />
        </ActionPanel>
      }
      isLoading={isLoading}>
      {!formData.baseUrl && (
        <Form.Description
          title='Environment Required'
          text='⚠️ Please select an environment first'
        />
      )}

      <Form.Dropdown
        id='baseUrl'
        title='Environment'
        value={formData.baseUrl}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, baseUrl: value }))
        }
        info='Select your API environment'>
        {BASE_URLS.map((env) => (
          <Form.Dropdown.Item
            key={env.id}
            value={env.url}
            title={env.title}
            icon={env.id === 'localhost' ? '💻' : '🌐'}
          />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      <Form.TextField
        id='email'
        title='Email'
        placeholder='Enter your email'
        value={formData.email}
        onChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
      />

      <Form.PasswordField
        id='password'
        title='Password'
        placeholder='Enter your password'
        value={formData.password}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, password: value }))
        }
      />

      <Form.Separator />

      <Form.Description
        title='Note'
        text='Your access token will be stored securely and used for API requests. You can sign out by clearing the stored tokens in the Configure API command.'
      />
    </Form>
  )
}
