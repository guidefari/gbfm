import { email } from './email'
import { allSecrets } from './secret'

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
// new sst.x.DevCommand("rename_to_cdn", {
// 	link: [database, email],
// 	dev: {
// 		command: "bun scripts/rename-audio-cdn-name.ts",
// 		directory: "./apps/vps",
// 		autostart: false,
// 	},
// });

new sst.x.DevCommand('Build_Container', {
  link: [email, ...allSecrets],
  dev: {
    command: 'docker build -f apps/vps/Dockerfile -t gbfm_vps .',
    directory: './',
    autostart: false
  }
})
new sst.x.DevCommand('Test_Docker', {
  link: [...allSecrets, email],
  dev: {
    command: 'docker run --rm -p 3003:3003 gbfm_vps',
    directory: './',
    autostart: false
  }
})
