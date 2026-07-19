import * as Atom from 'effect/unstable/reactivity/Atom'
import { getShowEpisodes } from '@/api/shows'

export const episodesFamily = Atom.family((slug: string) => Atom.make(getShowEpisodes(slug)))
