import * as Atom from 'effect/unstable/reactivity/Atom'
import { getShows } from '@/api/shows'

export const showsAtom = Atom.make(getShows)
