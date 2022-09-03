export type NowPlayingSong = {
  album: string
  albumImageUrl: string
  artist: string
  isPlaying: boolean
  songUrl: string
  title: string
}

export type Tweet = {
  authorName: string
  handle: string
  avatarUrl: string
  date: string
  children: React.ReactNode
}
