import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useEmailPreferences,
  useUpdateEmailPreferences,
  useUpdateProfile,
  useUserLOL
} from '@/lib/http'

export const Route = createFileRoute('/settings/profile')({
  component: Profile
})

export default function Profile() {
  const { data: user } = useUserLOL()
  const avatarId = useId()
  const { updateProfile } = useUpdateProfile()
  const { data: emailPreferences } = useEmailPreferences()
  const { updateEmailPreferences } = useUpdateEmailPreferences()

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const handleEmailPrefChange = (
    key: keyof typeof emailPrefs,
    value: boolean
  ) => {
    const newPrefs = { ...emailPrefs, [key]: value }
    setEmailPrefs(newPrefs)
    updateEmailPreferences(newPrefs)
  }

  const fields = [
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      placeholder: user?.username || 'Silly Goose',
      value: user?.username || ''
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: user?.email || 'silly@goose.fm',
      value: user?.email || ''
    }
    // {
    // 	name: "password",
    // 	label: "Password",
    // 	type: "password",
    // 	placeholder: "••••••••",
    // 	value: "",
    // },
  ]

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.id) return

    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)

      if (selectedFile) {
        formData.append('avatar', selectedFile)
      }

      updateProfile(formData)

      setSelectedFile(null)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto space-y-8 w-full max-w-md'>
        <div className='flex flex-col justify-center items-center space-y-2'>
          <div className='inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground'>
            Profile management
          </div>
        </div>
        <Card>
          <CardContent className='space-y-4'>
            <form onSubmit={onSubmit}>
              <div className='flex justify-center mb-6'>
                <div className='relative mr-4 w-20 h-20 rounded-full group'>
                  <img
                    src={imagePreview || user?.avatarUrl || '/placeholder.svg'}
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

              <div className='grid gap-2'>
                {fields.map((field) => (
                  <div className='grid gap-1' key={field.name}>
                    <div className='flex justify-between items-center'>
                      <Label htmlFor={field.name}>{field.label}</Label>
                    </div>
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
                  disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>

            <Accordion type='single' collapsible className='w-full mt-6'>
              <AccordionItem value='email-preferences'>
                <AccordionTrigger>Email Preferences</AccordionTrigger>
                <AccordionContent>
                  <div className='space-y-4'>
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
                          handleEmailPrefChange(
                            'mixReleaseEnabled',
                            e.target.checked
                          )
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
                          handleEmailPrefChange(
                            'promotionalEnabled',
                            e.target.checked
                          )
                        }
                        disabled={emailPrefs.globalUnsubscribe}
                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='flex-1'>
                        <Label
                          htmlFor='systemEnabled'
                          className='text-sm font-medium'>
                          System Notifications
                        </Label>
                        <p className='text-sm text-muted-foreground'>
                          Important updates about your account and system
                          changes
                        </p>
                      </div>
                      <input
                        id='systemEnabled'
                        type='checkbox'
                        checked={emailPrefs.systemEnabled}
                        onChange={(e) =>
                          handleEmailPrefChange(
                            'systemEnabled',
                            e.target.checked
                          )
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
                            handleEmailPrefChange(
                              'globalUnsubscribe',
                              e.target.checked
                            )
                          }
                          className='h-4 w-4 rounded border-gray-300 text-destructive focus:ring-2 focus:ring-destructive'
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
