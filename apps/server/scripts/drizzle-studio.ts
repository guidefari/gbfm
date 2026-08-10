import { BunRuntime } from '@effect/platform-bun'
import { Effect, Console } from 'effect'
import { spawnSync } from 'child_process'

type Target = 'local' | 'prod'

const createStudioEffect = (target: Target) =>
  Effect.gen(function* () {
    const configFile = target === 'local' ? 'drizzle.config.local.ts' : 'drizzle.config.prod.ts'
    const displayTarget = target === 'local' ? 'Local' : 'Production'

    yield* Console.log(`\n🔌 Starting Drizzle Studio for ${displayTarget} database...`)
    yield* Console.log(`   Config: ${configFile}\n`)

    const result = spawnSync('npx', ['drizzle-kit', 'studio', '--config', configFile], {
      env: process.env,
      stdio: 'inherit',
      shell: true
    })

    if (result.error) {
      yield* Console.error(`❌ Failed to start Drizzle Studio: ${result.error.message}`)
      return yield* Effect.fail(result.error)
    }

    if (result.status !== 0) {
      yield* Console.error(`❌ Drizzle Studio exited with code ${result.status}`)
      return yield* Effect.die(new Error(`Process exited with code ${result.status}`))
    }

    yield* Console.log('✅ Drizzle Studio closed')
  })

if (import.meta.main) {
  const targetArg = process.argv.find((a) => a.startsWith('--target='))?.split('=')[1]
  const target: Target = targetArg === 'prod' ? 'prod' : 'local'
  createStudioEffect(target).pipe(BunRuntime.runMain)
}
