export {
  sendEmail,
  sendTestEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  type EmailTemplate,
  type SendEmailOptions
} from './sender'

export {
  send,
  sendTemplate,
  sendSimpleEmail,
  getFromAddress,
  getToAddresses,
  type Attachment,
  type SendEmailProps,
  type SendTemplateEmailProps,
  type SimpleSendEmailOptions
} from './ses'

export { TestEmail } from '../emails/test-email'
export { WelcomeEmail } from '../emails/welcome'
export { PasswordResetEmail } from '../emails/password-reset'
