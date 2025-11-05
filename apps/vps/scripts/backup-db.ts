#!/usr/bin/env bun

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { ScheduledEvent } from "aws-lambda";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Database Backup Script
 *
 * This script creates a PostgreSQL database backup using pg_dump
 * and uploads it to an S3 bucket for safekeeping.
 *
 * Usage:
 *   bun run scripts/backup-db.ts
 *
 * For production:
 *   bun sst shell --stage=prod bun run scripts/backup-db.ts
 *
 * As Lambda handler (used by cron):
 *   Automatically invoked by CloudWatch Events
 */

async function backupDatabase() {
  console.log("🔄 Starting database backup...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

  try {
    // Create pg_dump process
    console.log("📦 Creating database dump...");

    const env = {
      PGPASSWORD: Resource.DatabasePassword.value,
      PGUSER: Resource.DatabaseUser.value,
      PGHOST: Resource.DatabaseHost.value,
      PGDATABASE: Resource.DatabaseName.value,
      PGPORT: Resource.DatabasePort.value,
    };

    const { stdout, stderr } = await execAsync(
      'pg_dump --no-owner --no-acl --clean --if-exists',
      {
        env: { ...process.env, ...env },
        maxBuffer: 1024 * 1024 * 100, // 100MB max buffer
      }
    );

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn("⚠️  pg_dump warnings:", stderr);
    }

    const backupData = Buffer.from(stdout);
    console.log(`✅ Database dump created (${(backupData.length / 1024 / 1024).toFixed(2)} MB)`);

    // Upload to S3
    console.log("☁️  Uploading to S3...");
    const s3Client = new S3Client({});

    await s3Client.send(
      new PutObjectCommand({
        Bucket: Resource.DatabaseBackupBucket.name,
        Key: filename,
        Body: backupData,
        ContentType: "application/sql",
        Metadata: {
          timestamp: new Date().toISOString(),
          database: Resource.DatabaseName.value,
          stage: process.env.SST_STAGE || "dev",
        },
      })
    );

    console.log(`✅ Backup uploaded successfully: ${filename}`);
    console.log(`📊 Bucket: ${Resource.DatabaseBackupBucket.name}`);
    console.log(`🎉 Backup complete!`);

    return {
      success: true,
      filename,
      bucket: Resource.DatabaseBackupBucket.name,
      size: backupData.length,
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
