import { createFileRoute, Link } from '@tanstack/react-router'
import { Calendar, FileMusic, Filter, Mic, Music, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { MixesSkeleton } from '@/components/MixesSkeleton'
import { TrackContextMenu } from '@/components/TrackContextMenu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createFileRoute('/tracks/')({
  component: TracksPage,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.tracks)
  })
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
  const {
    data: mixesData,
    isPending: mixesPending,
    fetchNextPage: fetchNextMixes,
    hasNextPage: hasNextMixes,
    isFetchingNextPage: isFetchingNextMixes
  } = useAudioByType('mix')

  const {
    data: tracksData,
    isPending: tracksPending,
    fetchNextPage: fetchNextTracks,
    hasNextPage: hasNextTracks,
    isFetchingNextPage: isFetchingNextTracks
  } = useAudioByType('track')

  const {
    data: miscData,
    isPending: miscPending,
    fetchNextPage: fetchNextMisc,
    hasNextPage: hasNextMisc,
    isFetchingNextPage: isFetchingNextMisc
  } = useAudioByType('misc')

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
              <Search className='absolute w-4 h-4 transform -translate-y-1/2 left-3 top-1/2 text-gb-default-text/60' />
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
            <TrackContextMenu key={item.id} track={item}>
              <Card className='transition-colors cursor-pointer bg-gb-darker-bg border-gb-pastel-green-2/20 hover:border-gb-highlight/50'>
                <CardContent className='p-4'>
                  <div className='flex gap-3'>
                    <div className='relative flex-shrink-0'>
                      <button
                        type='button'
                        className='relative group focus:outline-none'
                        onClick={() =>
                          loadTrack(
                            item.url,
                            item.thumbnailUrl || '',
                            item.title,
                            item.id,
                            item.creators,
                            item.slug
                          )
                        }>
                        <img
                          src={item.thumbnailUrl || DEFAULT_IMAGE_URL}
                          alt={item.title}
                          className='object-cover w-16 h-16 border rounded bg-gb-bg border-gb-pastel-green-2/20'
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
                        <div className='absolute rounded -inset-1 bg-gb-highlight/20 -z-10'></div>
                      )}
                    </div>

                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between mb-2'>
                        {item.type === 'mix' ? (
                          <Link
                            to='/mixes/$mixId'
                            params={{ mixId: item.slug }}
                            className='font-bold text-gb-highlight hover:underline line-clamp-2'>
                            {item.title}
                          </Link>
                        ) : item.type === 'track' ? (
                          <Link
                            to='/tracks/$trackId'
                            params={{ trackId: item.slug }}
                            className='font-bold text-gb-highlight hover:underline line-clamp-2'>
                            {item.title}
                          </Link>
                        ) : (
                          <a
                            href={`/misc/${item.slug}`}
                            className='font-bold text-gb-highlight hover:underline line-clamp-2'>
                            {item.title}
                          </a>
                        )}
                      </div>

                      <div className='flex items-center gap-2 mb-2 text-xs text-gb-default-text/70'>
                        <Badge
                          variant='secondary'
                          className='border-0 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
                          <span className='mr-1'>{getTypeIcon(item.type)}</span>
                          {getTypeLabel(item.type)}
                        </Badge>
                        <span className='flex items-center gap-1'>
                          <Calendar className='w-3 h-3' />
                          {formatDate(new Date(item.createdAt).toISOString())}
                        </span>
                      </div>

                      {item.description && (
                        <p className='mb-2 text-sm text-gb-default-text/80 line-clamp-2'>
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
            </TrackContextMenu>
          )
        })}
      </div>

      {/* Load More Buttons */}
      {filteredAndSortedData.length > 0 && (
        <div className='flex flex-col gap-3 mt-8'>
          {filterType === 'all' ? (
            <>
              {hasNextMixes && (
                <Button
                  variant='outline'
                  onClick={() => fetchNextMixes()}
                  disabled={isFetchingNextMixes}
                  className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
                  {isFetchingNextMixes ? 'Loading...' : 'Load More Mixes'}
                </Button>
              )}
              {hasNextTracks && (
                <Button
                  variant='outline'
                  onClick={() => fetchNextTracks()}
                  disabled={isFetchingNextTracks}
                  className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
                  {isFetchingNextTracks ? 'Loading...' : 'Load More Tracks'}
                </Button>
              )}
              {hasNextMisc && (
                <Button
                  variant='outline'
                  onClick={() => fetchNextMisc()}
                  disabled={isFetchingNextMisc}
                  className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
                  {isFetchingNextMisc ? 'Loading...' : 'Load More Other'}
                </Button>
              )}
            </>
          ) : filterType === 'mix' && hasNextMixes ? (
            <Button
              variant='outline'
              onClick={() => fetchNextMixes()}
              disabled={isFetchingNextMixes}
              className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
              {isFetchingNextMixes ? 'Loading...' : 'Load More Mixes'}
            </Button>
          ) : filterType === 'track' && hasNextTracks ? (
            <Button
              variant='outline'
              onClick={() => fetchNextTracks()}
              disabled={isFetchingNextTracks}
              className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
              {isFetchingNextTracks ? 'Loading...' : 'Load More Tracks'}
            </Button>
          ) : filterType === 'misc' && hasNextMisc ? (
            <Button
              variant='outline'
              onClick={() => fetchNextMisc()}
              disabled={isFetchingNextMisc}
              className='bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-default-text hover:bg-gb-pastel-green-2/20 disabled:opacity-50'>
              {isFetchingNextMisc ? 'Loading...' : 'Load More Other'}
            </Button>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {filteredAndSortedData.length === 0 && !isPending && (
        <div className='py-12 text-center'>
          <Music className='w-16 h-16 mx-auto mb-4 text-gb-default-text/40' />
          <h3 className='mb-2 text-lg font-semibold text-gb-default-text'>
            No tracks found
          </h3>
          <p className='mb-4 text-gb-default-text/70'>
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
