import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Music4, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { fetcher, useResolveMusicEntity, VPS_BASE_URL } from '@/lib/http'
import { useAuthStore } from '@/store'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

type PostType = 'post' | 'micro'

interface PostItem {
  id: string
  title: string
  description: string | null
  slug: string
  content: string
  thumbnailUrl: string | null
  tags: string[] | null
  draft: boolean
  type: PostType | null
  musicEntityType: 'album' | 'track' | 'playlist' | null
  musicEntityId: string | null
}

export const Route = createFileRoute('/admin/capture')({
  component: MusicCapturePage
})

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function MusicCapturePage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [musicUrl, setMusicUrl] = useState('')
  const [title, setTitle] = useState('')
  const [commentary, setCommentary] = useState('')

  const resolved = useResolveMusicEntity(musicUrl.trim())

  useEffect(() => {
    if (resolved.data?.entity?.title && !title) {
      setTitle(resolved.data.entity.title)
    }
  }, [resolved.data, title])

  const canSubmit = useMemo(() => {
    return Boolean(title.trim())
  }, [title])

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Please sign in')
      }

      const slugBase = generateSlug(title.trim() || 'tweet')
      const slug = `${slugBase}-${Date.now().toString(36)}`

      const payload = {
        title: title.trim(),
        description: undefined,
        slug,
        content: commentary,
        thumbnailUrl: undefined,
        tags: [],
        draft: false,
        type: 'micro' as const,
        musicEntityType: resolved.data?.entityType ?? null,
        musicEntityId: resolved.data?.entity?.id ?? null,
        creatorIds: [user.id]
      }

      return fetcher<PostItem>(`${VPS_BASE_URL}/content/post`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: (savedPost) => {
      toast({
        title: 'Tweet captured',
        description: `Saved as ${savedPost.slug}`
      })

      router.navigate({ to: `/tweet/${savedPost.slug}` })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to save tweet',
        description:
          error instanceof Error ? error.message : 'Something went wrong'
      })
    }
  })

  return (
    <AdminAccessGuard>
      <div className='container max-w-4xl py-8 mx-auto space-y-6'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <Link
              to='/admin'
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to admin
            </Link>
            <h1 className='text-3xl font-black tracking-tight'>
              Tweet Capture
            </h1>
            <p className='mt-2 text-muted-foreground'>
              Paste a music link, let the system resolve it, and capture the
              post fast.
            </p>
          </div>
          <Button asChild variant='outline'>
            <Link to='/admin/overview'>Overview</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Music4 className='w-5 h-5' />
              Resolve Music
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='musicUrl'>Music URL</Label>
              <Input
                id='musicUrl'
                value={musicUrl}
                onChange={(e) => setMusicUrl(e.target.value)}
                placeholder='https://open.spotify.com/track/...'
              />
            </div>

            <div className='grid gap-4 md:grid-cols-[160px_1fr]'>
              <div className='overflow-hidden border rounded-lg bg-muted aspect-square'>
                {resolved.data?.coverImageUrl ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    src={resolved.data.coverImageUrl}
                    alt='Cover art'
                    className='object-cover w-full h-full'
                  />
                ) : (
                  <div className='flex items-center justify-center h-full text-muted-foreground'>
                    {resolved.isLoading ? (
                      <Loader2 className='w-5 h-5 animate-spin' />
                    ) : (
                      <Music4 className='w-5 h-5' />
                    )}
                  </div>
                )}
              </div>

              <div className='space-y-3'>
                <div>
                  <div className='text-sm text-muted-foreground'>
                    Resolved type
                  </div>
                  <div className='font-medium'>
                    {resolved.data?.entityType || 'Waiting for a URL'}
                  </div>
                </div>
                <div>
                  <div className='text-sm text-muted-foreground'>Title</div>
                  <div className='font-medium'>
                    {resolved.data?.entity?.title || 'No entity resolved yet'}
                  </div>
                </div>
                {resolved.data?.entity?.artistNames?.length ? (
                  <div>
                    <div className='text-sm text-muted-foreground'>Artists</div>
                    <div className='font-medium'>
                      {resolved.data.entity.artistNames.join(', ')}
                    </div>
                  </div>
                ) : null}
                <div className='flex flex-wrap gap-2'>
                  {resolved.data?.links?.map((link) => (
                    <a
                      key={`${link.platform}-${link.url}`}
                      href={link.url}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground hover:text-foreground'>
                      {link.platform}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Short title for the tweet'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='commentary'>Commentary</Label>
              <Textarea
                id='commentary'
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder='Add your commentary in markdown...'
                className='min-h-40'
                onKeyDown={(e) => {
                  if (e.metaKey && e.key === 'Enter' && canSubmit) {
                    e.preventDefault()
                    submitMutation.mutate()
                  }
                }}
              />
            </div>

            <div className='flex items-center gap-3'>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
                className='gap-2'>
                {submitMutation.isPending ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Send className='w-4 h-4' />
                )}
                Save tweet
              </Button>
              <span className='text-sm text-muted-foreground'>
                Cmd+Enter submits
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminAccessGuard>
  )
}
