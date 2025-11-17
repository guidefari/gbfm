import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import {
  isPgDumpAvailable,
  createBackupWithPgDump,
  type BackupConfig,
} from "./backup-utils";

/**
 * Task Entrypoint for Database Backup
 *
 * This script runs inside an ECS Task (not Lambda)
 * It has access to pg_dump via the Docker image
 */

async function runBackup() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 Database Backup Task Started");
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

  try {
    const config: BackupConfig = {
      password: Resource.DatabasePassword.value,
      user: Resource.DatabaseUser.value,
      host: Resource.DatabaseHost.value,
      database: Resource.DatabaseName.value,
      port: Resource.DatabasePort.value,
    };

    console.log(`📊 Database Configuration:`);
    console.log(`   Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}`);

    console.log("\n🔍 Checking for backup tools...");
    const hasPgDump = await isPgDumpAvailable();

    if (!hasPgDump) {
      throw new Error("pg_dump not found in Docker container");
    }

    console.log("\n📦 Using pg_dump for backup");
    const sqlDump = await createBackupWithPgDump(config);

    const backupData = Buffer.from(sqlDump);
    const backupSizeMB = (backupData.length / 1024 / 1024).toFixed(2);
    console.log(`\n✅ Backup created successfully`);
    console.log(`   Size: ${backupSizeMB} MB`);
    console.log(`   Filename: ${filename}`);

    console.log("\n☁️  Uploading to S3...");
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
          method: "pg_dump",
          source: "ecs-task"
        },
      })
    );

    console.log(`\n✅ Upload successful!`);
    console.log(`   Bucket: ${Resource.DatabaseBackups.name}`);
    console.log(`   Key: ${filename}`);
    console.log(`   Size: ${backupSizeMB} MB`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Backup Task Completed Successfully");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit(0);
  } catch (error) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ Backup Task Failed");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Error details:", error);
    process.exit(1);
  }
}

runBackup();
