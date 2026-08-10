/** The finite set of templates this package can render. */
export const emailTemplateNames = [
  'test',
  'welcome',
  'password-reset',
  'invite',
  'music-reminder',
  'mix-notification',
  'new-user-notification',
  'newsletter-admin-notification',
  'newsletter-unsubscribe-link',
  'newsletter-welcome'
] as const

/** The name of an email template supported by this package. */
export type EmailTemplateName = (typeof emailTemplateNames)[number]

/** A provider-neutral, single-recipient email ready for delivery. */
export interface RenderedEmail<T extends EmailTemplateName = EmailTemplateName> {
  /** The template that produced this message. */
  readonly templateName: T
  /** The sole recipient of this message. */
  readonly to: string
  /** The message subject. */
  readonly subject: string
  /** The rendered HTML body. */
  readonly html: string
  /** The rendered plain-text body. */
  readonly text: string
  /** The optional address to which recipients can reply. */
  readonly replyTo?: string | undefined
}
