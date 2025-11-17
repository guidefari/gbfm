#!/usr/bin/env bun

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { ScheduledEvent } from "aws-lambda";
import {
  isPgDumpAvailable,
  createBackupWithPgDump,
  createBackupWithPg,
  type BackupConfig,
} from "./backup-utils";

/**
 * Database Backup Script
 *
 * This script creates a PostgreSQL database backup and uploads it to S3.
 * It will automatically use pg_dump if available, or fall back to a pure Node.js approach.
 *
 * Usage:
 *   bun run scripts/backup-db.ts
 *
 * For production:
 *   bun sst shell --stage=prod bun run scripts/backup-db.ts
 *
 * Environment Variables:
 *   LOCAL_DB_URL - Optional local database connection string
 *                  Format: postgres://user:password@host:port/database
 *
 * As Lambda handler (used by cron):
 *   Automatically invoked by CloudWatch Events
 */

async function backupDatabase() {
  console.log("🔄 Starting database backup...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

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

    const backupData = Buffer.from(sqlDump);
    console.log(`✅ Backup size: ${(backupData.length / 1024 / 1024).toFixed(2)} MB`);

    // Upload to S3
    console.log("☁️  Uploading to S3...");
    const s3Client = new S3Client({});

    await s3Client.send(
      new PutObjectCommand({
        Bucket: Resource.DatabaseBackups.name,
        Key: filename,
        Body: backupData,
        ContentType: "application/sql",
        Metadata: {
          timestamp: new Date().toISOString(),
          database: config.database,
          stage: process.env.SST_STAGE || "dev",
          method: hasPgDump ? "pg_dump" : "pg-library",
        },
      })
    );

    console.log(`✅ Backup uploaded successfully: ${filename}`);
    console.log(`📊 Bucket: ${Resource.DatabaseBackups.name}`);
    console.log(`🎉 Backup complete!`);

    return {
      success: true,
      filename,
      bucket: Resource.DatabaseBackups.name,
      size: backupData.length,
      method: hasPgDump ? "pg_dump" : "pg-library",
    };
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

// Lambda handler for cron job
export const handler = async (event: ScheduledEvent) => {
  console.log("Lambda cron triggered:", event.time);

  try {
    const result = await backupDatabase();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

// Direct execution (for manual runs)
if (import.meta.main) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
