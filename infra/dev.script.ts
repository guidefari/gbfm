import { allSecrets, secret } from './secret'

new sst.x.DevCommand('Alchemy', {
  dev: {
    command: 'bunx alchemy dev --stage=dev',
    directory: './',
    autostart: true
  }
})

new sst.x.DevCommand('Postgres_To_D1', {
  link: allSecrets,
  dev: {
    command: 'bun run scripts/migrate-pg-to-d1.ts',
    directory: './apps/server',
    autostart: false
  },
  environment: {
    PG_HOST: process.env.PG_HOST ?? secret.DatabaseHost.value,
    PG_PORT: process.env.PG_PORT ?? secret.DatabasePort.value,
    PG_USER: process.env.PG_USER ?? secret.DatabaseUser.value,
    PG_PASSWORD: process.env.PG_PASSWORD ?? secret.DatabasePassword.value,
    PG_DATABASE: process.env.PG_DATABASE ?? secret.DatabaseName.value,
    PG_SSL: process.env.PG_SSL ?? (process.env.PG_HOST === undefined ? 'true' : 'false')
  }
})

new sst.x.DevCommand('Mobile_Expo', {
  dev: {
    command: 'bun run start -- --lan',
    directory: './apps/mobile',
    autostart: false
  }
})

new sst.x.DevCommand('UI_Playground', {
  dev: {
    command: 'bun --filter @gbfm/ui dev',
    directory: './',
    autostart: false
  }
})

new sst.x.DevCommand('Studio_prod', {
  link: allSecrets,
  dev: {
    command: 'bun scripts/drizzle-studio.ts --target=prod',
    directory: './apps/server',
    autostart: false
  }
})
// new sst.x.DevCommand('Studio_local', {
//   link: allSecrets,
//   dev: {
//     command: 'bun scripts/drizzle-studio.ts --target=local',
//     directory: './apps/server',
//     autostart: false
//   }
// })

new sst.x.DevCommand('db_gen', {
  link: allSecrets,
  dev: {
    command: 'npx drizzle-kit generate --config drizzle.config.prod.ts',
    directory: './apps/server',
    autostart: false
  }
})

new sst.x.DevCommand('db_migrateProd', {
  link: allSecrets,
  dev: {
    command: 'bun run src/migrate.ts',
    directory: './apps/server',
    autostart: false
  }
})

new sst.x.DevCommand('betterAuthGen', {
  link: allSecrets,
  dev: {
    command: 'bunx @better-auth/cli@latest generate',
    directory: './apps/server',
    autostart: false
  },
  environment: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || ''
  }
})

// new sst.x.DevCommand('db_pushLocal', {
//   link: allSecrets,
//   dev: {
//     command: 'npx drizzle-kit push --config drizzle.config.local.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

new sst.x.DevCommand('db_pushProd', {
  link: allSecrets,
  dev: {
    command: 'npx drizzle-kit push --config drizzle.config.prod.ts',
    directory: './apps/server',
    autostart: false
  }
})

// new sst.x.DevCommand('Drizzle_Check_Prod', {
//   link: allSecrets,
//   dev: {
//     command: 'npx drizzle-kit check --config drizzle.config.prod.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })
// new sst.x.DevCommand("fix_mix_dates", {
//   link: allSecrets,
//   dev: {
//     command: "bun scripts/fix-mix-created-dates.ts",
//     directory: "./apps/server",
//     autostart: false,
//   },
// });

// new sst.x.DevCommand('Build_Container', {
//   link: allSecrets,
//   dev: {
//     command: 'docker build -f apps/server/Dockerfile -t gbfm_vps .',
//     directory: './',
//     autostart: false
//   }
// })
// new sst.x.DevCommand('Test_Docker', {
//   link: allSecrets,
//   dev: {
//     command: 'docker run --rm -p 3003:3003 gbfm_vps',
//     directory: './',
//     autostart: false
//   }
// })

new sst.x.DevCommand('Email_Preview', {
  link: allSecrets,
  dev: {
    command: 'bun dev',
    directory: './packages/email',
    autostart: false
  }
})

// new sst.x.DevCommand('Seed_Posts', {
//   link: allSecrets,
//   dev: {
//     command: 'bun src/archive/seed-posts.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Seed_Micro', {
//   link: allSecrets,
//   dev: {
//     command: 'bun src/archive/seed-micro.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Seed_Labels', {
//   link: allSecrets,
//   dev: {
//     command: 'bun src/archive/seed-labels.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Migrate_Labels', {
//   link: allSecrets,
//   dev: {
//     command: 'bun scripts/migrate-labels.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Assign_All_Relations_To_User', {
//   link: allSecrets,
//   dev: {
//     command: 'bun scripts/assign-all-relations-to-user.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Backfill_Episode_Numbers', {
//   link: allSecrets,
//   dev: {
//     command: 'bun scripts/backfill-episode-numbers.ts',
//     directory: './apps/server',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Backfill_Episode_Numbers_Apply', {
//   link: allSecrets,
//   dev: {
//     command: 'bun scripts/backfill-episode-numbers.ts --apply',
//     directory: './apps/server',
//     autostart: false
//   }
// })

new sst.x.DevCommand('Otel_Stack', {
  dev: {
    command: 'docker compose up jaeger -d',
    directory: './',
    autostart: false
  }
})
