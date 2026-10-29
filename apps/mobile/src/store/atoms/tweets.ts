import * as Atom from 'effect/reactivity/Atom'

import { getTweetsPage, getTweetScreen } from '@/api/tweets'

export const tweetsAtom = Atom.make(getTweetsPage(0))

export const tweetScreenFamily = Atom.family((slug: string) => Atom.make(getTweetScreen(slug)))
