import { QueryClientProvider } from '@tanstack/react-query'
import { MDXRendrr } from '@/components/MDXRendrr'
import { SpotifyConnectionProvider } from '@/components/spotify/SpotifyConnectionProvider'
import { queryClient } from '@/lib/query-client'
import { PlayerProvider } from '@/services/player'

/** Hydrates MDX custom components without turning the surrounding page into a React island. */
export function InteractiveMDX({ mdxString }: { readonly mdxString: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <SpotifyConnectionProvider>
          <MDXRendrr mdxString={mdxString} />
        </SpotifyConnectionProvider>
      </PlayerProvider>
    </QueryClientProvider>
  )
}
