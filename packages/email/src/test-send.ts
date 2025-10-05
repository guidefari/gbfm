#!/usr/bin/env bun

import { sendTestEmail } from './sender'

const DEFAULT_TEST_EMAIL = 'test@example.com'

async function main() {
  const args = process.argv.slice(2)
  const email = args[0] || DEFAULT_TEST_EMAIL

  if (!email) {
    console.error('Usage: bun test-send.ts <email>')
    process.exit(1)
  }

  console.log(`🧪 Sending test email to: ${email}`)

  try {
    await sendTestEmail({ to: email })
    console.log('✅ Test email sent successfully!')
  } catch (error) {
    console.error('❌ Failed to send test email:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
