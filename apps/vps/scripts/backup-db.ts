#!/usr/bin/env bun

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { ScheduledEvent } from "aws-lambda";
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { BunFileSystem } from "@effect/platform-bun";
import { FileSystem } from "@effect/platform";
import { Effect, Console } from "effect";
import {
  isPgDumpAvailable,
  createBackupWithPgDump,
  type BackupConfig,
} from "./backup-utils";

type BackupDestination = "s3" | "local";
type BackupSource = "local" | "remote";

interface BackupResult {
  success: boolean;
  filename: string;
  bucket?: string;
  path?: string;
  size: number;
  method: string;
}

const destinationOption = Options.choice("destination", ["s3", "local"]).pipe(
  Options.withDescription("Where to save the backup"),
  Options.withDefault("s3" as const)
);

const sourceOption = Options.choice("source", ["local", "remote"]).pipe(
  Options.withDescription("Which database to backup"),
  Options.withDefault("remote" as const)
);

function createBackupEffect(destination: BackupDestination, source: BackupSource) {
  return Effect.gen(function* (_) {
    yield* _(Console.log("🔄 Starting database backup..."));
    yield* _(Console.log(`   Source: ${source} database`));
    yield* _(Console.log(`   Destination: ${destination === "s3" ? "S3 bucket" : "local filesystem"}`));
    yield* _(Console.log("   💡 Run with --help to see all available options\n"));

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;

    let config: BackupConfig;

    if (source === "local") {
      const localDbUrl = process.env.LOCAL_DB_URL;
      if (!localDbUrl) {
        yield* _(Console.error("❌ LOCAL_DB_URL environment variable is required when using --source=local"));
        yield* _(Console.error("   Format: postgres://user:password@host:port/database"));
        yield* _(Console.error('\nExample: LOCAL_DB_URL="postgres://user:pass@localhost:5432/mydb" bun run scripts/backup-db.ts --source=local'));
        return yield* _(Effect.fail(new Error("LOCAL_DB_URL not set")));
      }

      yield* _(Console.log("🔗 Using LOCAL_DB_URL connection string"));
      const url = new URL(localDbUrl);

      config = {
        password: url.password || "",
        user: url.username,
        host: url.hostname,
        database: url.pathname.slice(1),
        port: url.port || "5432",
      };
    } else {
      yield* _(Console.log("🔗 Using SST Resource configuration"));

      const getResourceOrEnv = (resourceKey: string, envKey: string): string => {
        try {
          return (Resource as any)[resourceKey]?.value || process.env[envKey] || "";
        } catch {
          return process.env[envKey] || "";
        }
      };

      config = {
        password: getResourceOrEnv("DatabasePassword", "DatabasePassword"),
        user: getResourceOrEnv("DatabaseUser", "DatabaseUser"),
        host: getResourceOrEnv("DatabaseHost", "DatabaseHost"),
        database: getResourceOrEnv("DatabaseName", "DatabaseName"),
        port: getResourceOrEnv("DatabasePort", "DatabasePort"),
      };
    }

    yield* _(Console.log(`📊 Database: ${config.database}`));
    yield* _(Console.log(`   Host: ${config.host}:${config.port}`));

    const hasPgDump = yield* _(Effect.promise(() => isPgDumpAvailable()));

    if (!hasPgDump) {
      yield* _(Console.error("⚠️  pg_dump not found, exiting"));
      return yield* _(Effect.fail(new Error("pg_dump not available")));
    }

    yield* _(Console.log("✓ Using pg_dump (recommended)"));
    const sqlDump = yield* _(Effect.promise(() => createBackupWithPgDump(config)));

    const backupData = Buffer.from(sqlDump);
    yield* _(Console.log(`✅ Backup size: ${(backupData.length / 1024 / 1024).toFixed(2)} MB`));

    if (destination === "s3") {
      yield* _(Console.log("☁️  Uploading to S3..."));
      const s3Client = new S3Client({});

      const getBucketName = (): string => {
        try {
          return (Resource as any).DatabaseBackups?.name || process.env.DATABASE_BACKUP_BUCKET || "";
        } catch {
          return process.env.DATABASE_BACKUP_BUCKET || "";
        }
      };

      const bucketName = getBucketName();

      yield* _(Effect.promise(() =>
        s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
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
        )
      ));

      yield* _(Console.log(`✅ Backup uploaded successfully: ${filename}`));
      yield* _(Console.log(`📊 Bucket: ${bucketName}`));
      yield* _(Console.log("🎉 Backup complete!"));

      return {
        success: true,
        filename,
        bucket: bucketName,
        size: backupData.length,
        method: hasPgDump ? "pg_dump" : "pg-library",
      } as BackupResult;
    } else {
      const fs = yield* _(FileSystem.FileSystem);
      const backupsDir = `${process.cwd()}/backups`;
      const filePath = `${backupsDir}/${filename}`;

      yield* _(Console.log("💾 Saving to local filesystem..."));
      yield* _(fs.makeDirectory(backupsDir, { recursive: true }));
      yield* _(fs.writeFile(filePath, backupData));

      yield* _(Console.log(`✅ Backup saved successfully: ${filePath}`));
      yield* _(Console.log(`📊 Directory: ${backupsDir}`));
      yield* _(Console.log("🎉 Backup complete!"));

      return {
        success: true,
        filename,
        path: filePath,
        size: backupData.length,
        method: hasPgDump ? "pg_dump" : "pg-library",
      } as BackupResult;
    }
  }).pipe(
    Effect.catchAll((error) =>
      Console.error(`❌ Backup failed: ${error}`).pipe(
        Effect.flatMap(() => Effect.fail(error))
      )
    )
  );
}

const backupCommand = Command.make(
  "backup",
  { destination: destinationOption, source: sourceOption },
  ({ destination, source }) => createBackupEffect(destination, source)
).pipe(
  Command.withDescription("Create a PostgreSQL database backup and save it to S3 or local filesystem")
);

const cli = Command.run(backupCommand, {
  name: "Database Backup",
  version: "1.0.0",
});

export const handler = async (event: ScheduledEvent) => {
  console.log("Lambda cron triggered:", event.time);

  try {
    const result = await Effect.runPromise(
      createBackupEffect("s3", "remote").pipe(
        Effect.provideLayer(BunFileSystem.layer)
      )
    );

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

if (import.meta.main) {
  cli(process.argv).pipe(
    Effect.provide(BunFileSystem.layer),
    Effect.provide(BunContext.layer),
    BunRuntime.runMain
  );
}
