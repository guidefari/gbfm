#!/usr/bin/env bun

import { createConfig } from '../src/services/config.service'

const config = createConfig()

Bun.spawnSync(['psql'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...process.env,
    PGPASSWORD: config.database.password,
    PGUSER: config.database.user,
    PGHOST: config.database.host,
    PGDATABASE: config.database.name
  }
})
