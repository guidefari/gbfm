import { email } from "./email";
import { database } from "./vps";

new sst.x.DevCommand("Drizzle_Studio", {
	link: [database, email],
	dev: {
		command: "npx drizzle-kit studio",
		directory: "./apps/vps",
		autostart: false,
	},
});

new sst.x.DevCommand("Drizzle_Generate", {
	link: [database, email],
	dev: {
		command: "npx drizzle-kit generate",
		directory: "./apps/vps",
		autostart: false,
	},
});
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
new sst.x.DevCommand("Drizzle_Push", {
	link: [database, email],
	dev: {
		command: "npx drizzle-kit push",
		directory: "./apps/vps",
		autostart: false,
	},
});
// new sst.x.DevCommand("rename_to_cdn", {
// 	link: [database, email],
// 	dev: {
// 		command: "bun scripts/rename-audio-cdn-name.ts",
// 		directory: "./apps/vps",
// 		autostart: false,
// 	},
// });

