import { render } from '@react-email/components'
import { Data, Effect } from 'effect'
import type { ReactElement } from 'react'
import type { EmailTemplateName, RenderedEmail } from './message'

/** A safe, typed failure produced while rendering an email template. */
export class EmailRenderError extends Data.TaggedError('EmailRenderError')<{
  readonly templateName: EmailTemplateName
}> {}

/** The provider-neutral input required to render one email template. */
export interface RenderEmailInput<T extends EmailTemplateName> {
  /** The template being rendered. */
  readonly templateName: T
  /** The sole recipient of the rendered email. */
  readonly to: string
  /** The rendered email subject. */
  readonly subject: string
  /** The React Email component to render. */
  readonly component: ReactElement
  /** The optional address to which recipients can reply. */
  readonly replyTo?: string | undefined
}

function renderBody(
  component: ReactElement,
  templateName: EmailTemplateName,
  plainText: boolean
): Effect.Effect<string, EmailRenderError> {
  return Effect.tryPromise({
    try: () => (plainText ? render(component, { plainText: true }) : render(component)),
    catch: () => new EmailRenderError({ templateName })
  })
}

/**
 * Renders an email template into provider-neutral HTML and plain text.
 *
 * @returns An Effect that fails with `EmailRenderError` when rendering fails.
 */
export function renderEmail<T extends EmailTemplateName>(
  input: RenderEmailInput<T>
): Effect.Effect<RenderedEmail<T>, EmailRenderError> {
  return Effect.gen(function* () {
    const html = yield* renderBody(input.component, input.templateName, false)
    const text = yield* renderBody(input.component, input.templateName, true)

    return {
      templateName: input.templateName,
      to: input.to,
      subject: input.subject,
      html,
      text,
      replyTo: input.replyTo
    }
  }).pipe(
    Effect.tapError(() => Effect.annotateCurrentSpan('email.render_failure', true)),
    Effect.withSpan('email.render', { attributes: { 'email.template': input.templateName } })
  )
}
