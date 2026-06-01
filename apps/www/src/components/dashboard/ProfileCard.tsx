import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@gbfm/ui'
import { useId, useState } from 'react'
import type { useSession } from '@/lib/auth-client'
import { useUpdateProfile } from '@/lib/http'

type SessionUser = NonNullable<ReturnType<typeof useSession>['data']>['user']

interface ProfileCardProps {
  user: SessionUser
}

export function ProfileCard({ user }: ProfileCardProps) {
  const avatarId = useId()
  const { updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImagePreview(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const fields = [
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      placeholder: 'Choose a username',
      value: user?.username || ''
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <div className='flex justify-center mb-6'>
            <div className='relative mr-4 w-20 h-20 rounded-sm group'>
              <img
                src={imagePreview || user?.image || '/placeholder.svg'}
                alt='User Avatar'
                className='rounded-sm cursor-pointer'
                width={80}
                height={80}
              />
              <label
                htmlFor={avatarId}
                className='hidden absolute right-0 bottom-0 px-2 py-1 text-xs rounded-sm cursor-pointer group-hover:flex bg-gb-darker-bg'>
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
            <Button type='submit' className='w-full' disabled={isUpdatingProfile}>
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
