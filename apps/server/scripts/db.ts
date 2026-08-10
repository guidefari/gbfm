#!/usr/bin/env bun

import { config } from '../src/services/config.service'

console.log(config.database.password)
console.log(config.database.user)
console.log(config.database.host)
console.log(config.database.name)

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
