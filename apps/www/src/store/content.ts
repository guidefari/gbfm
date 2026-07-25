import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'

export type CurrentContent = {
  readonly id: string
  readonly archetype: string
  readonly creatorIds: ReadonlyArray<string>
}

export const currentContentAtom = Atom.make<CurrentContent | null>(null).pipe(Atom.keepAlive)

export const useCurrentContent = () => useAtomValue(currentContentAtom)

export const useSetCurrentContent = () => useAtomSet(currentContentAtom)

export const useCanEditCurrentContent = (userId: string | undefined) =>
  useAtomValue(currentContentAtom, (content) =>
    content && userId ? content.creatorIds.includes(userId) : false
  )
