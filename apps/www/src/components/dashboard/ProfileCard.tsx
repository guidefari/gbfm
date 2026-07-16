import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, useToast } from '@gbfm/ui'
import { useEffect, useId, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useUpdateProfile } from '@/lib/http'
import { log } from '@/services/logger'

type SessionUser = NonNullable<ReturnType<typeof useSession>['data']>['user']

interface ProfileCardProps {
  user: SessionUser
}

export function ProfileCard({ user }: ProfileCardProps) {
  const avatarId = useId()
  const { refetch: refetchSession } = useSession()
  const { updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const { toast } = useToast()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState(user.image ?? null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    setCurrentImage(user.image ?? null)
  }, [user.image])

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

      const updatedUser = await updateProfile(formData)

      setCurrentImage(updatedUser.image ?? null)
      setSelectedFile(null)
      setImagePreview(null)
      await refetchSession()
      toast({ title: 'Profile updated' })
    } catch (error) {
      log('error', 'Error updating profile', { error })
      toast({
        variant: 'destructive',
        title: 'Failed to update profile',
        description: 'Please try again later.'
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <div className='flex flex-col items-center gap-2 mb-6'>
            <label
              htmlFor={avatarId}
              className='relative w-20 h-20 rounded-sm cursor-pointer group'>
              {imagePreview || currentImage ? (
                <img
                  src={imagePreview || currentImage || ''}
                  alt='User Avatar'
                  className='object-cover w-20 h-20 rounded-sm'
                  width={80}
                  height={80}
                />
              ) : (
                <div className='flex justify-center items-center w-20 h-20 text-2xl rounded-sm bg-gb-darker-bg text-muted-foreground'>
                  {(user?.username || user?.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className='flex absolute inset-0 justify-center items-center text-xs opacity-0 transition-opacity rounded-sm group-hover:opacity-100 bg-black/60'>
                Change
              </div>
              <input
                id={avatarId}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleImageChange}
              />
            </label>
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
