import { allMixes } from '@/contentlayer/generated'
import { compareDesc } from 'date-fns'

export const DEFAULT_IMAGE_URL =
  'https://res.cloudinary.com/hokaspokas/image/upload/v1687381805/goosebumpsfm/gb-fm-retro.png'

export const LATEST_MIX = allMixes.sort((a, b) =>
  compareDesc(new Date(a.date), new Date(b.date))
)[0]
