import * as Atom from 'effect/unstable/reactivity/Atom'
import { getFeaturedMix } from '@/api/audio'

export const featuredMixAtom = Atom.make(getFeaturedMix)
