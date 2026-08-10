/** The Cloudflare Email identity and destination policy for one deployment stage. */
export interface EmailDeploymentConfig {
  /** The verified sending subdomain. */
  readonly sendingDomain: string
  /** The full sender address injected into the Worker. */
  readonly emailSender: string
  /** The required non-production destination restriction, if applicable. */
  readonly destinationAddress: string | undefined
}

/** Input that Alchemy supplies when deriving a stage's email policy. */
export interface EmailDeploymentConfigInput {
  /** The Alchemy deployment stage. */
  readonly stage: string
  /** The controlled non-production recipient from deployment configuration. */
  readonly testRecipient?: string
}

/** Derives the DNS-safe Cloudflare Email configuration without reading ambient environment. */
export function emailDeploymentConfig({
  stage,
  testRecipient
}: EmailDeploymentConfigInput): EmailDeploymentConfig {
  if (stage === 'prod') {
    return {
      sendingDomain: 'mail.goosebumps.fm',
      emailSender: 'noreply@mail.goosebumps.fm',
      destinationAddress: undefined
    }
  }

  const stageLabel = stage
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 58)
  if (stageLabel.length === 0) {
    throw new Error('Non-production stage must produce a DNS-safe sending subdomain label')
  }

  const destinationAddress = testRecipient?.trim()
  if (destinationAddress === undefined || destinationAddress.length === 0) {
    throw new Error('EMAIL_TEST_RECIPIENT is required for non-production email sending')
  }

  const sendingDomain = `mail-${stageLabel}.goosebumps.fm`
  return {
    sendingDomain,
    emailSender: `noreply@${sendingDomain}`,
    destinationAddress
  }
}
