import * as Atom from 'effect/reactivity/Atom'

import { getFeaturedMix } from '@/api/audio'

export const featuredMixAtom = Atom.make(getFeaturedMix)
