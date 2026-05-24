#!/usr/bin/env bun

import { sendPersonalWelcomeEmail } from '@gbfm/email/sender'
import * as readline from 'node:readline'

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const to = (await ask(rl, 'Recipient email: ')).trim()
  if (!to || !to.includes('@')) {
    console.error('Invalid email address.')
    rl.close()
    process.exit(1)
  }

  const nameInput = (await ask(rl, 'Recipient name (optional, Enter to skip): ')).trim()
  rl.close()

  const name = nameInput || undefined

  console.log(`\nSending to: ${to}${name ? ` (${name})` : ''}`)

  await sendPersonalWelcomeEmail({ to, name })

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
