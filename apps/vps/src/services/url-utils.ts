export const getIdFromSpotifyUrl = (url: string): string | null => {
  const regex = /\/(\w+)\?/
  const match = url.match(regex)
  return match?.[1] || null
}

export const cleanId = (id: string): string | null => {
  try {
    const decodedUrl = decodeURIComponent(id)
    new URL(decodedUrl)
    return getIdFromSpotifyUrl(decodedUrl)
  } catch (_error) {
    return id
  }
}

export const isSpotifyUrl = (url: string): boolean =>
  url.includes('spotify.com') || url.includes('spotify.link')

export const isYouTubeUrl = (url: string): boolean =>
  url.includes('youtube.com') || url.includes('youtu.be')

export const isAppleMusicUrl = (url: string): boolean =>
  url.includes('music.apple.com')

export const isBandcampUrl = (url: string): boolean =>
  url.includes('bandcamp.com')

export const extractSpotifyId = (url: string): string | null => {
  const patterns = [
    /spotify\.com\/track\/([a-zA-Z0-9]+)/,
    /spotify\.com\/album\/([a-zA-Z0-9]+)/,
    /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
    /spotify\.link\/([a-zA-Z0-9]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export const extractBandcampId = (url: string): string | null => {
  const match =
    url.match(/bandcamp\.com\/album\/([^/?]+)/) ||
    url.match(/bandcamp\.com\/track\/([^/?]+)/)
  return match?.[1] || null
}
