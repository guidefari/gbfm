import { Match, Option, Schema } from 'effect'

export const readModeCookie = 'gbfm-tweet-read-mode'

const ReadMode = Schema.Literals(['unread', 'all'])

export const skipsSeenTweets = (cookies: string | null) => {
  const value = cookies
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${readModeCookie}=`))
    ?.slice(readModeCookie.length + 1)

  return Option.getOrElse(Schema.decodeUnknownOption(ReadMode)(value), () => 'unread') === 'unread'
}

export const startTweetShortcuts = () => {
  const keydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return
    const target = event.target

    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest('button, summary, input, textarea, select, dialog[open]'))
    )
      return

    if (
      document.querySelector(
        'dialog[open], aside[aria-label="Menu"], details[name="tweet-jumps"][open]',
      )
    )
      return

    const id = Match.value(event.key).pipe(
      Match.when('ArrowLeft', () => 'tweet-newer'),
      Match.when('ArrowRight', () => 'tweet-older'),
      Match.orElse(() => null),
    )

    const link = id ? document.getElementById(id) : null

    if (!(link instanceof HTMLAnchorElement)) return
    event.preventDefault()
    link.click()
  }

  window.addEventListener('keydown', keydown)

  return () => window.removeEventListener('keydown', keydown)
}
