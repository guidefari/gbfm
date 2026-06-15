import { Card, CardContent, CardHeader, CardTitle, Label } from '@gbfm/ui'
import { useEffect, useState } from 'react'
import { useEmailPreferences, useUpdateEmailPreferences } from '@/lib/http'

export function EmailPreferencesCard() {
  const { data: emailPreferences } = useEmailPreferences()
  const { updateEmailPreferences } = useUpdateEmailPreferences()

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

  const handleEmailPrefChange = async (key: keyof typeof emailPrefs, value: boolean) => {
    const newPrefs = { ...emailPrefs, [key]: value }
    setEmailPrefs(newPrefs)
    try {
      await updateEmailPreferences(newPrefs)
    } catch (error) {
      console.error('Error updating email preferences:', error)
      setEmailPrefs(emailPrefs)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Preferences</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <Label htmlFor='mixReleaseEnabled' className='text-sm font-medium'>
              New Mix & Show Updates
            </Label>
            <p className='text-sm text-muted-foreground'>
              The newsletter: get notified when a new mix or show drops
            </p>
          </div>
          <input
            id='mixReleaseEnabled'
            type='checkbox'
            checked={emailPrefs.mixReleaseEnabled}
            onChange={(e) => handleEmailPrefChange('mixReleaseEnabled', e.target.checked)}
            disabled={emailPrefs.globalUnsubscribe}
            className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
          />
        </div>

        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <Label htmlFor='promotionalEnabled' className='text-sm font-medium'>
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
            onChange={(e) => handleEmailPrefChange('promotionalEnabled', e.target.checked)}
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
            onChange={(e) => handleEmailPrefChange('systemEnabled', e.target.checked)}
            disabled={emailPrefs.globalUnsubscribe}
            className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50'
          />
        </div>

        <div className='border-t pt-4'>
          <div className='flex items-center justify-between'>
            <div className='flex-1'>
              <Label htmlFor='globalUnsubscribe' className='text-sm font-medium text-destructive'>
                Unsubscribe from All
              </Label>
              <p className='text-sm text-muted-foreground'>
                Opt out of the newsletter and all non-essential emails
              </p>
            </div>
            <input
              id='globalUnsubscribe'
              type='checkbox'
              checked={emailPrefs.globalUnsubscribe}
              onChange={(e) => handleEmailPrefChange('globalUnsubscribe', e.target.checked)}
              className='h-4 w-4 rounded border-gray-300 text-destructive focus:ring-2 focus:ring-destructive'
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
