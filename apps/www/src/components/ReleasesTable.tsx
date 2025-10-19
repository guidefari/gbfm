import type { SelectRelease } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'

interface ReleasesTableProps {
  releases: SelectRelease[]
}

export function ReleasesTable({ releases }: ReleasesTableProps) {
  if (!releases || releases.length === 0) {
    return (
      <div className='px-4 py-6 mt-8 border-t border-border'>
        <h3 className='mb-4 text-lg font-semibold'>Releases</h3>
        <p className='text-muted-foreground'>
          No releases found for this label.
        </p>
      </div>
    )
  }

  return (
    <div className='mt-8'>
      <h3 className='mb-4 text-lg font-semibold'>
        Releases ({releases.length})
      </h3>
      <div className='overflow-x-auto'>
        <table className='w-full border-collapse'>
          <thead>
            <tr className='border-b border-border'>
              <th className='px-2 py-3 text-sm font-medium text-left text-muted-foreground'>
                Cover
              </th>
              <th className='px-2 py-3 text-sm font-medium text-left text-muted-foreground'>
                Title
              </th>
              <th className='px-2 py-3 text-sm font-medium text-left text-muted-foreground'>
                Release Date
              </th>
              <th className='px-2 py-3 text-sm font-medium text-left text-muted-foreground'>
                Streaming Links
              </th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr
                key={release.id}
                className='border-b border-border/50 hover:bg-muted/50'>
                <td className='px-2 py-3'>
                  <div className='overflow-hidden w-16 h-16 rounded-md bg-muted'>
                    <img
                      src={release.thumbnailUrl || '/fav.png'}
                      alt={`Cover for ${release.title}`}
                      className='object-cover w-full h-full'
                      loading='lazy'
                    />
                  </div>
                </td>
                <td className='px-2 py-3'>
                  <Link
                    to='/releases/$slug'
                    params={{ slug: release.slug }}
                    className='font-medium transition-colors hover:text-primary'>
                    {release.title}
                  </Link>
                  {release.description && (
                    <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                      {release.description}
                    </p>
                  )}
                </td>
                <td className='px-2 py-3 text-sm'>
                  {release.releaseDate
                    ? new Date(release.releaseDate).toLocaleDateString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }
                      )
                    : 'TBA'}
                </td>
                <td className='px-2 py-3'>
                  {release.streamingLinks &&
                  release.streamingLinks.length > 0 ? (
                    <div className='flex flex-wrap gap-1'>
                      {release.streamingLinks.map(
                        (
                          link: { platform: string; url: string },
                          index: number
                        ) => (
                          <a
                            key={index}
                            href={link.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-colors bg-primary/10 hover:bg-primary/20'>
                            {link.platform}
                          </a>
                        )
                      )}
                    </div>
                  ) : (
                    <span className='text-sm text-muted-foreground'>
                      No links
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
