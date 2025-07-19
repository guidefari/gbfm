#!/usr/bin/env bun

import { Resource } from "sst";

console.log(Resource.gbfm_postgres);

Bun.spawnSync(["psql"], {
	stdout: "inherit",
	stderr: "inherit",
	env: {
		...process.env,
		PGPASSWORD: Resource.gbfm_postgres.password,
		PGUSER: Resource.gbfm_postgres.username,
		PGHOST: Resource.gbfm_postgres.host,
		PGDATABASE: Resource.gbfm_postgres.database,
	},
});
