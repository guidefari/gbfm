import { Effect, Queue, Schema, Stream } from 'effect'
import { Mount } from 'foldkit'

import { Message } from '../message'
import { Action, type Status } from './model'

interface Turnstile {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      action: string
      appearance: 'interaction-only'
      'response-field': false
      callback: (token: string) => void
      'error-callback': () => void
      'expired-callback': () => void
      'timeout-callback': () => void
    },
  ) => string
  remove: (id: string) => void
  reset: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

/** The runtime owns the script, widget, native form listeners and in-flight request. */
export const SignupChallenge = Mount.defineStream('SignupChallenge', {
  args: { sitekey: Schema.String, action: Action },
  messages: [Message.ChallengeStatusChanged],
  execute: ({ element, sitekey, action }) =>
    Stream.callback<typeof Message.ChallengeStatusChanged.Type>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            if (!(element instanceof HTMLFormElement)) return () => {}

            const host = element.querySelector<HTMLElement>('[data-turnstile]')

            if (!host) return () => {}

            const controller = new AbortController()
            let active = true
            let widget: string | undefined
            let token = ''
            let submitting = false

            const status = (value: Status) => {
              if (active)
                Queue.offerUnsafe(queue, Message.ChallengeStatusChanged({ status: value }))
            }

            const fail = () => {
              token = ''
              status('failed')
            }

            const render = () => {
              if (!active || !window.turnstile || widget !== undefined) return

              try {
                widget = window.turnstile.render(host, {
                  sitekey,
                  action,
                  appearance: 'interaction-only',
                  'response-field': false,
                  callback: (value) => {
                    if (!active) return
                    token = value
                    status('ready')
                  },
                  'error-callback': fail,
                  'expired-callback': fail,
                  'timeout-callback': fail,
                })
              } catch {
                fail()
              }
            }

            let script: HTMLScriptElement | undefined
            let loadTimeout: ReturnType<typeof setTimeout> | undefined

            const loaded = () => {
              clearTimeout(loadTimeout)

              if (window.turnstile) render()
              else fail()
            }

            const unloadScript = () => {
              clearTimeout(loadTimeout)
              script?.removeEventListener('load', loaded)
              script?.removeEventListener('error', fail)
              script?.remove()
            }

            const loadScript = () => {
              unloadScript()
              script = document.createElement('script')
              script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
              script.async = true
              script.addEventListener('load', loaded)
              script.addEventListener('error', fail)
              loadTimeout = setTimeout(fail, 15_000)
              document.head.append(script)
            }

            const retry = (event: Event) => {
              if (
                !(event.target instanceof Element) ||
                !event.target.closest('[data-challenge-retry]')
              )
                return
              token = ''
              status('verifying')

              if (widget !== undefined && window.turnstile) window.turnstile.reset(widget)
              else if (window.turnstile) render()
              else loadScript()
            }

            const submit = async (event: SubmitEvent) => {
              event.preventDefault()

              if (!token || submitting) return
              submitting = true
              status('submitting')
              const body = new FormData(element)
              body.set('cf-turnstile-response', token)
              token = ''

              try {
                const response = await fetch(element.action, {
                  method: 'POST',
                  body,
                  signal: controller.signal,
                })

                if (!active) return

                if (response.ok && response.redirected) {
                  window.location.assign(response.url)

                  return
                }

                fail()
              } catch {
                fail()
              } finally {
                submitting = false
              }
            }

            element.addEventListener('click', retry)
            element.addEventListener('submit', submit)
            status(sitekey ? 'verifying' : 'unavailable')

            if (sitekey) {
              if (window.turnstile) render()
              else loadScript()
            }

            return () => {
              active = false
              controller.abort()
              unloadScript()
              element.removeEventListener('click', retry)
              element.removeEventListener('submit', submit)

              if (widget !== undefined) window.turnstile?.remove(widget)
            }
          }),
          (cleanup) => Effect.sync(cleanup),
        )

        return yield* Effect.never
      }),
    ),
})
