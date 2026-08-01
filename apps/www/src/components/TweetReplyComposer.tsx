import { Button, Input, Textarea, useToast } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { Loader2, Music4 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useCreateMicroPostReply, useResolveMusicEntity } from '@/lib/http'
import { useTweetReplyComposer, useTweetReplyComposerActions } from '@/store/tweetReplyComposer'

type Props = {
  parentSlug: string
}

export function TweetReplyComposer({ parentSlug }: Props) {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const { isOpen, draft, musicUrl } = useTweetReplyComposer()
  const { open, setDraft, setMusicUrl, reset } = useTweetReplyComposerActions()
  const { toast } = useToast()
  const createReply = useCreateMicroPostReply(parentSlug)
  const resolved = useResolveMusicEntity(musicUrl.trim())

  if (!isAuthenticated) {
    return (
      <p className='text-sm text-muted-foreground'>
        <Link to='/auth/sign-in' className='underline'>
          Sign in
        </Link>{' '}
        to reply
      </p>
    )
  }

  if (!isOpen) {
    return (
      <Button type='button' variant='outline' size='sm' className='rounded-sm' onClick={open}>
        Reply
      </Button>
    )
  }

  const handleSubmit = async () => {
    const content = draft.trim()
    if (!content) return

    try {
      await createReply.mutateAsync({
        content,
        musicEntityType: resolved.data?.entityType,
        musicEntityId: resolved.data?.entity?.id
      })
      reset()
      toast({ title: 'Reply posted' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to post reply',
        description: 'Please try again later.'
      })
    }
  }

  return (
    <div className='space-y-2 rounded-lg border border-border/60 bg-card/60 p-3'>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder='Write a reply…'
        className='h-20'
        autoFocus
      />
      <div className='relative'>
        <Input
          value={musicUrl}
          onChange={(e) => setMusicUrl(e.target.value)}
          placeholder='Paste a music link (optional)'
          className='h-8 text-xs pr-8'
        />
        {resolved.isLoading && (
          <Loader2 className='absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground' />
        )}
      </div>
      {resolved.data?.entity && (
        <div className='flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-xs'>
          {resolved.data.coverImageUrl ? (
            <img
              src={resolved.data.coverImageUrl}
              alt=''
              className='size-6 shrink-0 rounded-sm object-cover'
            />
          ) : (
            <Music4 className='size-4 shrink-0 text-muted-foreground' />
          )}
          <span className='truncate text-muted-foreground'>{resolved.data.entity.title}</span>
        </div>
      )}
      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onClick={reset}>
          Cancel
        </Button>
        <Button
          type='button'
          size='sm'
          disabled={createReply.isPending || !draft.trim()}
          onClick={handleSubmit}>
          {createReply.isPending ? 'Posting…' : 'Post reply'}
        </Button>
      </div>
    </div>
  )
}
