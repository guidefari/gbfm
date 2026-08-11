import { describe, expect, test } from 'vitest'
import { emailDeploymentConfig } from './email-deployment-config'

describe('emailDeploymentConfig', () => {
  test('uses the unrestricted production identity', () => {
    expect(emailDeploymentConfig({ stage: 'prod' })).toEqual({
      sendingDomain: 'mail.goosebumps.fm',
      emailSender: 'noreply@mail.goosebumps.fm',
      destinationAddress: undefined,
      transport: 'cloudflare'
    })
  })

  test('uses a DNS-safe stage identity and trimmed controlled destination outside production', () => {
    expect(
      emailDeploymentConfig({ stage: 'Email Staging!', testRecipient: ' listener@example.com ' })
    ).toEqual({
      sendingDomain: 'mail-email-staging.goosebumps.fm',
      emailSender: 'noreply@mail-email-staging.goosebumps.fm',
      destinationAddress: 'listener@example.com',
      transport: 'cloudflare'
    })
  })

  test.each([
    {
      stage: 'dev',
      sendingDomain: 'mail-dev.goosebumps.fm',
      emailSender: 'noreply@mail-dev.goosebumps.fm'
    },
    {
      stage: 'prod',
      sendingDomain: 'mail.goosebumps.fm',
      emailSender: 'noreply@mail.goosebumps.fm'
    }
  ])('uses the recording transport without requiring a recipient in local dev %#', (input) => {
    expect(emailDeploymentConfig({ stage: input.stage, localDev: true })).toEqual({
      sendingDomain: input.sendingDomain,
      emailSender: input.emailSender,
      destinationAddress: undefined,
      transport: 'recording'
    })
  })

  test.each([
    { stage: '', testRecipient: 'listener@example.com' },
    { stage: '!!!', testRecipient: 'listener@example.com' },
    { stage: 'staging', testRecipient: undefined },
    { stage: 'staging', testRecipient: '   ' }
  ])('rejects empty or invalid stage configuration %#', (input) => {
    expect(() => emailDeploymentConfig(input)).toThrow()
  })
})
