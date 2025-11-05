import { email } from './email'
import { allSecrets } from './secret'
import { dbBackupBucket } from './bucket'

new sst.x.DevCommand('raycast', {
  dev: {
    command: 'bun dev',
    directory: './apps/raycast',
    autostart: false
  }
})

new sst.x.DevCommand('ios', {
  dev: {
    command: 'bun ios',
    directory: './apps/mobile',
    autostart: false
  }
})

new sst.x.DevCommand('Drizzle_Studio', {
  link: [...allSecrets, email],
  dev: {
    command: 'npx drizzle-kit studio',
    directory: './apps/vps',
    autostart: false
  }
})

new sst.x.DevCommand('Drizzle_Generate', {
  link: [...allSecrets, email],
  dev: {
    command: 'npx drizzle-kit generate',
    directory: './apps/vps',
    autostart: false
  }
})
// new sst.x.DevCommand("Drizzle_Migrate", {
// 	link: [database, email],
// 	dev: {
// 		command: "npx drizzle-kit migrate",
// 		directory: "./apps/vps",
// 		autostart: false,
// 	},
// });
// new sst.x.DevCommand("Drizzle_Check", {
// 	link: [database, email],
// 	dev: {
// 		command: "npx drizzle-kit check",
// 		directory: "./apps/vps",
// 		autostart: false,
// 	},
// });
new sst.x.DevCommand('Drizzle_Push', {
  link: [...allSecrets, email],
  dev: {
    command: 'npx drizzle-kit push',
    directory: './apps/vps',
    autostart: false
  }
})
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

new sst.x.DevCommand('Backup_Database', {
  link: [...allSecrets, email, dbBackupBucket],
  dev: {
    command: 'bun scripts/backup-db.ts',
    directory: './apps/vps',
    autostart: false
  }
})
