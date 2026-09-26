import { Option, Schema } from 'effect'

export const ReadMode = Schema.Literals(['unread', 'all'])

export type ReadMode = typeof ReadMode.Type

export const READ_MODE_COOKIE = 'gbfm-tweet-read-mode'

export const parseReadMode = (value: FormDataEntryValue | null | undefined): ReadMode =>
  Option.getOrElse(Schema.decodeUnknownOption(ReadMode)(value), (): ReadMode => 'unread')
