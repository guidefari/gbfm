#!/usr/bin/env bun

import { Resource } from "sst";

console.log(Resource.DatabasePassword.value);
console.log(Resource.DatabaseUser.value);
console.log(Resource.DatabaseHost.value);
console.log(Resource.DatabaseName.value);

Bun.spawnSync(["psql"], {
	stdout: "inherit",
	stderr: "inherit",
	env: {
		...process.env,
		PGPASSWORD: Resource.DatabasePassword.value,
		PGUSER: Resource.DatabaseUser.value,
		PGHOST: Resource.DatabaseHost.value,
		PGDATABASE: Resource.DatabaseName.value,
	},
});
