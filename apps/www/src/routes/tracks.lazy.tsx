import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import {
  Clock,
  Calendar,
  Music,
  Mic,
  FileMusic,
  Filter,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MixesSkeleton } from '@/components/MixesSkeleton'
import { useAudioByType } from '@/lib/http'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createLazyFileRoute('/tracks')({
  component: TracksPage
})

type AudioType = 'all' | 'mix' | 'track' | 'misc'
type SortBy = 'date' | 'title'
type SortOrder = 'asc' | 'desc'

function TracksPage() {
  const [filterType, setFilterType] = useState<AudioType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Fetch data for all types
  const { data: mixesData, isPending: mixesPending } = useAudioByType('mix')
  const { data: tracksData, isPending: tracksPending } = useAudioByType('track')
  const { data: miscData, isPending: miscPending } = useAudioByType('misc')

  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

  const allData = useMemo(() => {
    const combined = [
      ...(mixesData || []),
      ...(tracksData || []),
      ...(miscData || [])
    ]
    return combined
  }, [mixesData, tracksData, miscData])

  const filteredAndSortedData = useMemo(() => {
    let filtered = allData

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((item) => item.type === filterType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      } else {
        const titleA = a.title.toLowerCase()
        const titleB = b.title.toLowerCase()
        return sortOrder === 'asc'
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA)
      }
    })

    return filtered
  }, [allData, filterType, searchQuery, sortBy, sortOrder])

  const isPending = mixesPending || tracksPending || miscPending

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mix':
        return <Music className='w-4 h-4' />
      case 'track':
        return <Mic className='w-4 h-4' />
      case 'misc':
        return <FileMusic className='w-4 h-4' />
      default:
        return <Music className='w-4 h-4' />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'mix':
        return 'Mix'
      case 'track':
        return 'Track'
      case 'misc':
        return 'Other'
      default:
        return type
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isPending) {
    return <MixesSkeleton />
  }

  return (
    <div className='px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gb-highlight'>All Tracks</h1>
        <p className='mt-2 text-gb-default-text'>
          Browse and play all audio content
        </p>
      </div>

      {/* Filters and Search */}
      <div className='mb-8 space-y-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          <div className='flex-1'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gb-default-text/60' />
              <Input
                placeholder='Search tracks, descriptions, tags...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-10 bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text focus:border-gb-highlight'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <Select
              value={filterType}
              onValueChange={(value: AudioType) => setFilterType(value)}>
              <SelectTrigger className='w-32 bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text'>
                <Filter className='w-4 h-4 mr-2' />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                <SelectItem value='all'>All Types</SelectItem>
                <SelectItem value='mix'>Mixes</SelectItem>
                <SelectItem value='track'>Tracks</SelectItem>
                <SelectItem value='misc'>Other</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: SortBy) => setSortBy(value)}>
              <SelectTrigger className='w-24 bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
                <SelectItem value='date'>Date</SelectItem>
                <SelectItem value='title'>Title</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant='outline'
              size='sm'
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20'>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className='text-sm text-gb-default-text/80'>
          {filteredAndSortedData.length} track
          {filteredAndSortedData.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Tracks Grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filteredAndSortedData.map((item) => {
          const isActive = nowPlayingContext?.title === item.title
          return (
            <Card
              key={item.id}
              className='bg-gb-darker-bg border-gb-pastel-green-2/20 hover:border-gb-highlight/50 transition-colors'>
              <CardContent className='p-4'>
                <div className='flex gap-3'>
                  <div className='relative flex-shrink-0'>
                    <button
                      type='button'
                      className='relative group focus:outline-none'
                      onClick={() =>
                        loadTrack(item.url, item.thumbnailUrl, item.title)
                      }>
                      <img
                        src={item.thumbnailUrl || '/placeholder.svg'}
                        alt={item.title}
                        className='w-16 h-16 rounded border object-cover bg-gb-bg border-gb-pastel-green-2/20'
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center rounded transition-opacity bg-black/50 ${
                          isActive
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                        }`}>
                        {isActive && isPlaying ? (
                          <GiPauseButton className='text-2xl text-gb-highlight' />
                        ) : (
                          <GiPlayButton className='text-2xl text-gb-highlight' />
                        )}
                      </div>
                    </button>
                    {isActive && (
                      <div className='absolute -inset-1 rounded bg-gb-highlight/20 -z-10'></div>
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between mb-2'>
                      <Link
                        to='/read/$archetype/$id'
                        params={{ archetype: item.type, id: item.slug }}
                        className='font-bold text-gb-highlight hover:underline line-clamp-2'>
                        {item.title}
                      </Link>
                    </div>

                    <div className='flex items-center gap-2 mb-2 text-xs text-gb-default-text/70'>
                      <Badge
                        variant='secondary'
                        className='bg-gb-pastel-green-2/20 text-gb-pastel-green-1 border-0'>
                        <span className='mr-1'>{getTypeIcon(item.type)}</span>
                        {getTypeLabel(item.type)}
                      </Badge>
                      <span className='flex items-center gap-1'>
                        <Calendar className='w-3 h-3' />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>

                    {item.description && (
                      <p className='text-sm text-gb-default-text/80 line-clamp-2 mb-2'>
                        {item.description}
                      </p>
                    )}

                    {item.tags && item.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1'>
                        {item.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant='outline'
                            className='text-xs bg-transparent border-gb-pastel-green-2/30 text-gb-default-text/70'>
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 3 && (
                          <Badge
                            variant='outline'
                            className='text-xs bg-transparent border-gb-pastel-green-2/30 text-gb-default-text/70'>
                            +{item.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredAndSortedData.length === 0 && !isPending && (
        <div className='text-center py-12'>
          <Music className='w-16 h-16 mx-auto mb-4 text-gb-default-text/40' />
          <h3 className='text-lg font-semibold text-gb-default-text mb-2'>
            No tracks found
          </h3>
          <p className='text-gb-default-text/70 mb-4'>
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No audio content has been uploaded yet'}
          </p>
          <Link to='/upload'>
            <Button className='bg-gb-pastel-green-2 hover:bg-gb-highlight text-gb-darker-bg'>
              Upload New Track
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
