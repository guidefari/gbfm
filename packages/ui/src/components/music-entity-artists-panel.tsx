import { useState } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Input } from './input'

export interface ArtistJunction {
  artistId: string
  artistName: string
  role?: string | null
  displayOrder: number
}

export interface MusicEntityArtistsPanelProps {
  artists: ArtistJunction[]
  onAdd?: (artistId: string, role?: string) => void
  onRemove?: (artistId: string) => void
  readOnly?: boolean
}

export function MusicEntityArtistsPanel({
  artists,
  onAdd,
  onRemove,
  readOnly = false
}: MusicEntityArtistsPanelProps) {
  const [artistId, setArtistId] = useState('')
  const [role, setRole] = useState('')

  function handleAdd() {
    if (!artistId.trim()) return
    onAdd?.(artistId.trim(), role.trim() || undefined)
    setArtistId('')
    setRole('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Artists</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {artists.length === 0 && (
          <p className='text-sm text-muted-foreground'>No artists linked.</p>
        )}
        <ul className='space-y-2'>
          {[...artists]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((a) => (
              <li
                key={a.artistId}
                className='flex items-center gap-3 rounded-md border px-3 py-2 text-sm'>
                <span className='flex-1 font-medium'>{a.artistName}</span>
                {a.role && (
                  <span className='text-xs capitalize text-muted-foreground'>
                    {a.role}
                  </span>
                )}
                {!readOnly && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='text-destructive'
                    onClick={() => onRemove?.(a.artistId)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
        </ul>
        {!readOnly && (
          <div className='flex gap-2'>
            <Input
              placeholder='Artist ID (UUID)'
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className='flex-1'
            />
            <Input
              placeholder='Role (optional)'
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className='w-32'
            />
            <Button onClick={handleAdd} variant='outline'>
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
