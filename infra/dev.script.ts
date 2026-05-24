import { dbBackupBucket } from './bucket'
// import { dbBackupCron } from './cron'
import { email } from './email'
import { allSecrets, secret } from './secret'

// new sst.x.DevCommand('raycast', {
//   dev: {
//     command: 'bun dev',
//     directory: './apps/raycast',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('ios', {
//   dev: {
//     command: 'bun ios',
//     directory: './apps/mobile',
//     autostart: false
//   }
// })

new sst.x.DevCommand('UI_Playground', {
  dev: {
    command: 'bun --filter @gbfm/ui dev',
    directory: './',
    autostart: false
  }
})

new sst.x.DevCommand('Studio_prod', {
  link: [...allSecrets, email],
  dev: {
    command: 'bun scripts/drizzle-studio.ts --target=prod',
    directory: './apps/vps',
    autostart: false
  }
})
// new sst.x.DevCommand('Studio_local', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun scripts/drizzle-studio.ts --target=local',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

new sst.x.DevCommand('db_gen', {
  link: [...allSecrets, email],
  dev: {
    command: 'npx drizzle-kit generate --config drizzle.config.prod.ts',
    directory: './apps/vps',
    autostart: false
  }
})

new sst.x.DevCommand('betterAuthGen', {
  link: [...allSecrets, email],
  dev: {
    command: 'bunx @better-auth/cli@latest generate',
    directory: './apps/vps',
    autostart: false
  },
  environment: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || ''
  }
})

// new sst.x.DevCommand('db_pushLocal', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'npx drizzle-kit push --config drizzle.config.local.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

new sst.x.DevCommand('db_pushProd', {
  link: [...allSecrets, email],
  dev: {
    command: 'npx drizzle-kit push --config drizzle.config.prod.ts',
    directory: './apps/vps',
    autostart: false
  }
})

// new sst.x.DevCommand('Drizzle_Check_Prod', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'npx drizzle-kit check --config drizzle.config.prod.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })
// new sst.x.DevCommand("fix_mix_dates", {
//   link: [...allSecrets, email],
//   dev: {
//     command: "bun scripts/fix-mix-created-dates.ts",
//     directory: "./apps/vps",
//     autostart: false,
//   },
// });

// new sst.x.DevCommand('Build_Container', {
//   link: [email, ...allSecrets],
//   dev: {
//     command: 'docker build -f apps/vps/Dockerfile -t gbfm_vps .',
//     directory: './',
//     autostart: false
//   }
// })
// new sst.x.DevCommand('Test_Docker', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'docker run --rm -p 3003:3003 gbfm_vps',
//     directory: './',
//     autostart: false
//   }
// })

new sst.x.DevCommand('Send_Personal_Welcome', {
  link: [email, ...allSecrets],
  dev: {
    command: 'bun scripts/send-personal-welcome.ts',
    directory: './apps/vps',
    autostart: false
  }
})

new sst.x.DevCommand('Email_Preview', {
  link: [email, ...allSecrets],
  dev: {
    command: 'bun dev',
    directory: './packages/email',
    autostart: false
  }
})

// new sst.x.DevCommand('Seed_Posts', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun src/archive/seed-posts.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Seed_Micro', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun src/archive/seed-micro.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Seed_Labels', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun src/archive/seed-labels.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Migrate_Labels', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun scripts/migrate-labels.ts',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Backup_Database', {
//   link: [...allSecrets, email, dbBackupBucket],
//   dev: {
//     command: 'bun scripts/backup-db.ts --source=local',
//     directory: './apps/vps',
//     autostart: false
//   },
//   environment: {
//     DATABASE_BACKUP_BUCKET: dbBackupBucket.name,
//     DatabaseHost: secret.DatabaseHost.value,
//     DatabaseUser: secret.DatabaseUser.value,
//     DatabasePassword: secret.DatabasePassword.value,
//     DatabasePort: secret.DatabasePort.value,
//     DatabaseName: secret.DatabaseName.value,
//     LOCAL_DB_URL: process.env.LOCAL_DB_URL || ''
//   }
// })

new sst.x.DevCommand('Backup_Database_Prod', {
  link: [...allSecrets, email, dbBackupBucket],
  dev: {
    command: 'bun scripts/backup-db.ts --source=remote --destination=s3',
    directory: './apps/vps',
    autostart: false
  },
  environment: {
    DATABASE_BACKUP_BUCKET: dbBackupBucket.name,
    DatabaseHost: secret.DatabaseHost.value,
    DatabaseUser: secret.DatabaseUser.value,
    DatabasePassword: secret.DatabasePassword.value,
    DatabasePort: secret.DatabasePort.value,
    DatabaseName: secret.DatabaseName.value
  }
})

// new sst.x.DevCommand('Backup_Database_Docker', {
//   link: [...allSecrets, email, dbBackupBucket],
//   dev: {
//     command: './scripts/docker-backup-s3.sh',
//     directory: './apps/vps',
//     autostart: false
//   }
// })

// new sst.x.DevCommand('Restore_Prod_Database', {
//   link: [...allSecrets, email, dbBackupBucket],
//   dev: {
//     command: 'bun scripts/restore-db.ts --source=s3 --destination=planetscale',
//     directory: './apps/vps',
//     autostart: false
//   },
//   environment: {
//     PLANETSCALE_DB_URL: process.env.PROD_DB_URL || ''
//   }
// })

new sst.x.DevCommand('Verify_Backup', {
  link: [...allSecrets, email, dbBackupBucket],
  dev: {
    command: 'bun scripts/verify-backup.ts',
    directory: './apps/vps',
    autostart: false
  },
  environment: {
    DATABASE_BACKUP_BUCKET: dbBackupBucket.name
  }
})

// new sst.x.DevCommand('Restore_Local_Database', {
//   link: [...allSecrets, email, dbBackupBucket],
//   dev: {
//     command: 'bun scripts/restore-db.ts --source=s3 --destination=local',
//     directory: './apps/vps',
//     autostart: false
//   },
//   environment: {
//     LOCAL_DB_URL: process.env.LOCAL_DB_URL || ''
//   }
// })

// new sst.x.DevCommand('Assign_All_Relations_To_User', {
//   link: [...allSecrets, email],
//   dev: {
//     command: 'bun scripts/assign-all-relations-to-user.ts',
//     directory: './apps/vps',
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
