import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/lib/auth-client'
import {
  useEmailPreferences,
  useUpdateEmailPreferences,
  useUpdateProfile
} from '@/lib/http'
import { useUIStore } from '@/store/ui'

export const Route = createFileRoute('/settings/profile')({
  component: Profile
})

export default function Profile() {
  const { data: session, isPending: isLoadingSession } = useSession()
  const user = session?.user
  const avatarId = useId()
  const { updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const { data: emailPreferences } = useEmailPreferences()
  const { updateEmailPreferences } = useUpdateEmailPreferences()
  const { preferredPlayerType, setPreferredPlayerType } = useUIStore()

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [emailPrefs, setEmailPrefs] = useState({
    mixReleaseEnabled: emailPreferences?.mixReleaseEnabled ?? true,
    promotionalEnabled: emailPreferences?.promotionalEnabled ?? true,
    systemEnabled: emailPreferences?.systemEnabled ?? true,
    globalUnsubscribe: emailPreferences?.globalUnsubscribe ?? false
  })

  useEffect(() => {
    if (emailPreferences) {
      setEmailPrefs({
        mixReleaseEnabled: emailPreferences.mixReleaseEnabled,
        promotionalEnabled: emailPreferences.promotionalEnabled,
        systemEnabled: emailPreferences.systemEnabled,
        globalUnsubscribe: emailPreferences.globalUnsubscribe
      })
    }
  }, [emailPreferences])

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEmailPrefChange = async (
    key: keyof typeof emailPrefs,
    value: boolean
  ) => {
    const newPrefs = { ...emailPrefs, [key]: value }
    setEmailPrefs(newPrefs)
    try {
      await updateEmailPreferences(newPrefs)
    } catch (error) {
      console.error('Error updating email preferences:', error)
      setEmailPrefs(emailPrefs)
    }
  }

  const fields = [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: user?.name || 'Silly Goose',
      value: user?.name || ''
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: user?.email || 'silly@goose.fm',
      value: user?.email || ''
    }
  ]

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.id) return

    try {
      const formData = new FormData(e.currentTarget)

      if (selectedFile) {
        formData.append('avatar', selectedFile)
      }

      await updateProfile(formData)

      setSelectedFile(null)
      setImagePreview(null)
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  if (isLoadingSession) {
    return (
      <div className='flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <div>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className='flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <div>Please sign in to view your profile</div>
      </div>
    )
  }

  return (
    <div className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto space-y-6 w-full max-w-2xl'>
        <div>
          <h1 className='text-2xl font-bold'>Settings</h1>
          <p className='text-muted-foreground'>
            Manage your account and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit}>
              <div className='flex justify-center mb-6'>
                <div className='relative mr-4 w-20 h-20 rounded-full group'>
                  <img
                    src={imagePreview || user?.image || '/placeholder.svg'}
                    alt='User Avatar'
                    className='rounded-full cursor-pointer'
                    width={80}
                    height={80}
                  />
                  <label
                    htmlFor={avatarId}
                    className='hidden absolute right-0 bottom-0 px-2 py-1 text-xs rounded-full cursor-pointer group-hover:flex bg-gb-darker-bg'>
                    Change
                    <input
                      id={avatarId}
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                {selectedFile && (
                  <div className='self-end mb-2 text-xs text-muted-foreground'>
                    Avatar will be saved with profile
                  </div>
                )}
              </div>

              <div className='grid gap-4'>
                {fields.map((field) => (
                  <div className='grid gap-1.5' key={field.name}>
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      name={field.name}
                      defaultValue={field.value}
                    />
                  </div>
                ))}
                <Button
                  type='submit'
                  className='w-full'
                  disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Player Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className='text-sm text-muted-foreground mb-4'>
                Choose how the audio player appears across the app
              </p>
              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={() => setPreferredPlayerType('full')}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-all text-left ${
                    preferredPlayerType === 'full'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}>
                  <div className='font-medium'>Full Player</div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    Bottom bar with all controls
                  </div>
                </button>
                <button
                  type='button'
                  onClick={() => setPreferredPlayerType('compact')}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-all text-left ${
                    preferredPlayerType === 'compact'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}>
                  <div className='font-medium'>Compact Player</div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    Floating mini player
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Preferences</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex-1'>
                <Label
                  htmlFor='mixReleaseEnabled'
                  className='text-sm font-medium'>
                  Mix Release Notifications
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Get notified when new mixes are released
                </p>
              </div>
              <input
                id='mixReleaseEnabled'
                type='checkbox'
                checked={emailPrefs.mixReleaseEnabled}
                onChange={(e) =>
                  handleEmailPrefChange('mixReleaseEnabled', e.target.checked)
                }
                disabled={emailPrefs.globalUnsubscribe}
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex-1'>
                <Label
                  htmlFor='promotionalEnabled'
                  className='text-sm font-medium'>
                  Promotional Emails
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Receive updates about new features and promotions
                </p>
              </div>
              <input
                id='promotionalEnabled'
                type='checkbox'
                checked={emailPrefs.promotionalEnabled}
                onChange={(e) =>
                  handleEmailPrefChange('promotionalEnabled', e.target.checked)
                }
                disabled={emailPrefs.globalUnsubscribe}
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex-1'>
                <Label htmlFor='systemEnabled' className='text-sm font-medium'>
                  System Notifications
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Important updates about your account and system changes
                </p>
              </div>
              <input
                id='systemEnabled'
                type='checkbox'
                checked={emailPrefs.systemEnabled}
                onChange={(e) =>
                  handleEmailPrefChange('systemEnabled', e.target.checked)
                }
                disabled={emailPrefs.globalUnsubscribe}
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
              />
            </div>

            <div className='border-t pt-4'>
              <div className='flex items-center justify-between'>
                <div className='flex-1'>
                  <Label
                    htmlFor='globalUnsubscribe'
                    className='text-sm font-medium text-destructive'>
                    Unsubscribe from All
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Opt out of all non-transactional emails
                  </p>
                </div>
                <input
                  id='globalUnsubscribe'
                  type='checkbox'
                  checked={emailPrefs.globalUnsubscribe}
                  onChange={(e) =>
                    handleEmailPrefChange('globalUnsubscribe', e.target.checked)
                  }
                  className='h-4 w-4 rounded border-gray-300 text-destructive focus:ring-2 focus:ring-destructive'
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
