import { allMixes } from '@/contentlayer/generated'
import { compareDesc } from 'date-fns'

export const DEFAULT_IMAGE_URL = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

export const LATEST_MIX = allMixes.sort((a, b) =>
  compareDesc(new Date(a.date), new Date(b.date))
)[0]
