#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Resource } from "sst";
import {
  isPgDumpAvailable,
  createBackupWithPgDump,
  createBackupWithPg,
  type BackupConfig,
} from "./backup-utils";

/**
 * Local Database Backup Script
 *
 * This script creates a PostgreSQL database backup and saves it to a local directory.
 * It will automatically use pg_dump if available, or fall back to a pure Node.js approach.
 *
 * Usage:
 *   bun run scripts/backup-db-local.ts
 *
 * Environment Variables:
 *   LOCAL_DB_URL - Optional local database connection string
 *                  Format: postgres://user:password@host:port/database
 *
 * Examples:
 *   # Use SST resources (default)
 *   bun run scripts/backup-db-local.ts
 *
 *   # Use local connection string
 *   LOCAL_DB_URL=postgres://user:password@localhost:5432/mydb bun run scripts/backup-db-local.ts
 */

async function backupDatabaseLocal() {
  console.log("🔄 Starting local database backup...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

  // Create backups directory if it doesn't exist
  const backupsDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupsDir)) {
    await mkdir(backupsDir, { recursive: true });
    console.log(`📁 Created backups directory: ${backupsDir}`);
  }

  const backupPath = path.join(backupsDir, filename);

  try {
    let config: BackupConfig;

    // Check if LOCAL_DB_URL is provided
    if (process.env.LOCAL_DB_URL) {
      console.log("🔗 Using LOCAL_DB_URL connection string");
      const url = new URL(process.env.LOCAL_DB_URL);

      config = {
        password: url.password || "",
        user: url.username,
        host: url.hostname,
        database: url.pathname.slice(1), // Remove leading slash
        port: url.port || "5432",
      };
    } else {
      console.log("🔗 Using SST Resource configuration");
      config = {
        password: Resource.DatabasePassword.value,
        user: Resource.DatabaseUser.value,
        host: Resource.DatabaseHost.value,
        database: Resource.DatabaseName.value,
        port: Resource.DatabasePort.value,
      };
    }

    console.log(`📊 Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);

    // Check if pg_dump is available
    const hasPgDump = await isPgDumpAvailable();

    let sqlDump: string;
    if (hasPgDump) {
      console.log("✓ Using pg_dump (recommended)");
      sqlDump = await createBackupWithPgDump(config);
    } else {
      console.log("⚠️  pg_dump not found, using pure Node.js backup");
      console.log("   Install PostgreSQL client tools for better backup quality:");
      console.log("   - macOS: brew install postgresql");
      console.log("   - Ubuntu/Debian: sudo apt-get install postgresql-client");
      console.log("   - Windows: Download from postgresql.org\n");
      sqlDump = await createBackupWithPg(config);
    }

    // Write to file
    await Bun.write(backupPath, sqlDump);

    const fileSize = (await Bun.file(backupPath).size);
    console.log(`📂 Location: ${backupPath}`);
    console.log(`📦 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🎉 Local backup complete!`);

    return {
      success: true,
      filename,
      path: backupPath,
      size: fileSize,
      method: hasPgDump ? 'pg_dump' : 'pg-library',
    };
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

// Direct execution
if (import.meta.main) {
  backupDatabaseLocal()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
