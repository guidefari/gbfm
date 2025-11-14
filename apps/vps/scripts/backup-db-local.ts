#!/usr/bin/env bun

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Resource } from "sst";

const execAsync = promisify(exec);

/**
 * Local Database Backup Script
 *
 * This script creates a PostgreSQL database backup using pg_dump
 * and saves it to a local directory.
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
    let env: Record<string, string>;

    // Check if LOCAL_DB_URL is provided
    if (process.env.LOCAL_DB_URL) {
      console.log("🔗 Using LOCAL_DB_URL connection string");
      const url = new URL(process.env.LOCAL_DB_URL);

      env = {
        PGPASSWORD: url.password || "",
        PGUSER: url.username,
        PGHOST: url.hostname,
        PGDATABASE: url.pathname.slice(1), // Remove leading slash
        PGPORT: url.port || "5432",
      };
    } else {
      console.log("🔗 Using SST Resource configuration");
      env = {
        PGPASSWORD: Resource.DatabasePassword.value,
        PGUSER: Resource.DatabaseUser.value,
        PGHOST: Resource.DatabaseHost.value,
        PGDATABASE: Resource.DatabaseName.value,
        PGPORT: Resource.DatabasePort.value,
      };
    }

    console.log(`📦 Creating database dump for ${env.PGDATABASE}...`);
    console.log(`   Host: ${env.PGHOST}:${env.PGPORT}`);

    const { stderr } = await execAsync(
      `pg_dump --no-owner --no-acl --clean --if-exists --file="${backupPath}"`,
      {
        env: { ...process.env, ...env },
        maxBuffer: 1024 * 1024 * 100, // 100MB max buffer
      }
    );

    if (stderr && !stderr.includes("NOTICE")) {
      console.warn("⚠️  pg_dump warnings:", stderr);
    }

    // Get file size
    const { size } = await Bun.file(backupPath).exists().then(() =>
      Bun.file(backupPath).size
    );

    console.log(`✅ Database dump created (${(size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`📂 Location: ${backupPath}`);
    console.log(`🎉 Local backup complete!`);

    return {
      success: true,
      filename,
      path: backupPath,
      size,
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
