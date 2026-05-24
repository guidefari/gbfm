#!/usr/bin/env bun

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BunFileSystem, BunRuntime } from "@effect/platform-bun";
import { sendBackupNotificationEmail } from "@gbfm/email/index";
import type { ScheduledEvent } from "aws-lambda";
import { Console, Effect, FileSystem } from "effect";
import { Resource } from "sst";
import {
  type BackupConfig,
  createBackupWithPgDump,
  isPgDumpAvailable,
  withLogCapture,
} from "./backup-utils";
import { EmailError } from "../src/errors";

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

const sendNotificationEmail = (
  status: "success" | "failure",
  backupConfig: BackupConfig,
  filename: string,
  backupSize: number,
  logs: string,
  errorMessage?: string,
  stackTrace?: string
) =>
  Effect.tryPromise({
    try: () =>
      sendBackupNotificationEmail({
        to: process.env.ADMIN_EMAIL ?? "guidefari@icloud.com",
        status,
        timestamp: new Date().toISOString(),
        database: backupConfig.database,
        host: `${backupConfig.host}:${backupConfig.port}`,
        filename,
        fileSize: `${(backupSize / 1024 / 1024).toFixed(2)} MB`,
        errorMessage,
        stackTrace,
        logContent: logs,
        stage: process.env.SST_STAGE || "dev",
      }),
    catch: (error) => 
      error instanceof Error 
        ? new EmailError({
            message: `Failed to send email: ${error.message}`,
            emailAddress: process.env.ADMIN_EMAIL ?? "guidefari@icloud.com"
          })
        : new EmailError({
            message: `Failed to send email: Unknown error: ${String(error)}`,
            emailAddress: process.env.ADMIN_EMAIL ?? "guidefari@icloud.com"
          }),
  }).pipe(
    Effect.tap(() => Console.log(`📧 Notification email sent (${status})`)),
    Effect.catch((error) =>
      Console.error(`Failed to send notification email: ${error}`)
    )
  );


function createBackupEffect(
  destination: BackupDestination,
  backupSource: BackupSource
) {
  return withLogCapture((capture) =>
    Effect.gen(function* () {
      yield* Console.log("🔄 Starting database backup...");
      yield* Console.log(`   Source: ${backupSource} database`);
      yield* Console.log(
        `   Destination: ${destination === "s3" ? "S3 bucket" : "local filesystem"}`
      );
      yield* Console.log("   💡 Run with --help to see all available options\n");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup-${timestamp}.sql`;

      let backupConfig: BackupConfig;

      if (backupSource === "local") {
        const localDbUrl = process.env.LOCAL_DB_URL;
        if (!localDbUrl) {
          yield* Console.error(
            "❌ LOCAL_DB_URL environment variable is required when using --source=local"
          );
          yield* Console.error("   Format: postgres://user:password@host:port/database");
          yield* Console.error(
            '\nExample: LOCAL_DB_URL="postgres://user:pass@localhost:5432/mydb" bun run scripts/backup-db.ts --source=local'
          );
          return yield* Effect.die(new Error("LOCAL_DB_URL not set"));
        }

        yield* Console.log("🔗 Using LOCAL_DB_URL connection string");
        const url = new URL(localDbUrl);

        backupConfig = {
          password: url.password || "",
          user: url.username,
          host: url.hostname,
          database: url.pathname.slice(1),
          port: url.port || "5432",
        };
      } else {
        yield* Console.log("🔗 Using SST Resource configuration");

        const getResourceOrEnv = (
          resourceKey: string,
          envKey: string
        ): string => {
          try {
            return (
              (Resource as unknown as Record<string, { value?: string }>)[
                resourceKey
              ]?.value ||
              process.env[envKey] ||
              ""
            );
          } catch {
            return process.env[envKey] || "";
          }
        };

        backupConfig = {
          password: getResourceOrEnv("DatabasePassword", "DatabasePassword"),
          user: getResourceOrEnv("DatabaseUser", "DatabaseUser"),
          host: getResourceOrEnv("DatabaseHost", "DatabaseHost"),
          database: getResourceOrEnv("DatabaseName", "DatabaseName"),
          port: getResourceOrEnv("DatabasePort", "DatabasePort"),
        };
      }

      yield* Console.log(`📊 Database: ${backupConfig.database}`);
      yield* Console.log(`   Host: ${backupConfig.host}:${backupConfig.port}`);

      const hasPgDump = yield* Effect.promise(() => isPgDumpAvailable());

      if (!hasPgDump) {
        yield* Console.error("⚠️  pg_dump not found, exiting");
        const logs = yield* capture.getLogs;
        yield* sendNotificationEmail(
          "failure",
          backupConfig,
          filename,
          0,
          logs,
          "pg_dump not available"
        );
        return yield* Effect.die(new Error("pg_dump not available"));
      }

      yield* Console.log("✓ Using pg_dump (recommended)");
      const sqlDump = yield* Effect.promise(() => createBackupWithPgDump(backupConfig));

      const backupData = Buffer.from(sqlDump);
      yield* Console.log(
        `✅ Backup size: ${(backupData.length / 1024 / 1024).toFixed(2)} MB`
      );

      if (destination === "s3") {
        yield* Console.log("☁️  Uploading to S3...");
        const s3Client = new S3Client({});

        const getBucketName = (): string => {
          try {
            return (
              (Resource as unknown as Record<string, { name?: string }>)
                .DatabaseBackups?.name ||
              process.env.DATABASE_BACKUP_BUCKET ||
              ""
            );
          } catch {
            return process.env.DATABASE_BACKUP_BUCKET || "";
          }
        };

        const bucketName = getBucketName();

        yield* Effect.promise(() =>
          s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: filename,
              Body: backupData,
              ContentType: "application/sql",
              Metadata: {
                timestamp: new Date().toISOString(),
                database: backupConfig.database,
                stage: process.env.SST_STAGE || "dev",
                method: "pg_dump",
              },
            })
          )
        );

        yield* Console.log(`✅ Backup uploaded successfully: ${filename}`);
        yield* Console.log(`📊 Bucket: ${bucketName}`);
        yield* Console.log("🎉 Backup complete!");

        const logs = yield* capture.getLogs;
        yield* sendNotificationEmail(
          "success",
          backupConfig,
          filename,
          backupData.length,
          logs
        );

        return {
          success: true,
          filename,
          bucket: bucketName,
          size: backupData.length,
          method: "pg_dump",
        } as BackupResult;
      }
      const fs = yield* FileSystem.FileSystem;
      const backupsDir = `${process.cwd()}/backups`;
      const filePath = `${backupsDir}/${filename}`;

      yield* Console.log("💾 Saving to local filesystem...");
      yield* fs.makeDirectory(backupsDir, { recursive: true });
      yield* fs.writeFile(filePath, backupData);

      yield* Console.log(`✅ Backup saved successfully: ${filePath}`);
      yield* Console.log(`📊 Directory: ${backupsDir}`);
      yield* Console.log("🎉 Backup complete!");

      const logs = yield* capture.getLogs;
      yield* sendNotificationEmail(
        "success",
        backupConfig,
        filename,
        backupData.length,
        logs
      );

      return {
        success: true,
        filename,
        path: filePath,
        size: backupData.length,
        method: "pg_dump",
      } as BackupResult;
    }).pipe(
      Effect.tapError((error) =>
        Effect.gen(function* () {
          const logs = yield* capture.getLogs;
          yield* sendNotificationEmail(
            "failure",
            {
              password: "",
              user: "unknown",
              host: "unknown",
              database: "unknown",
              port: "5432",
            },
            "",
            0,
            logs,
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined
          );
        })
      ),
      Effect.catch((error) =>
        Console.error(`❌ Backup failed: ${error}`).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      )
    )
  );
}

export const handler = async (event: ScheduledEvent) => {
  console.log("Lambda cron triggered:", event.time);

  try {
    const result = await Effect.runPromise(
      createBackupEffect("s3", "remote").pipe(Effect.provide(BunFileSystem.layer))
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
  const destArg = process.argv.find((a) => a.startsWith("--destination="))?.split("=")[1];
  const srcArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  const destination: BackupDestination = destArg === "local" ? "local" : "s3";
  const source: BackupSource = srcArg === "local" ? "local" : "remote";
  createBackupEffect(destination, source).pipe(
    Effect.provide(BunFileSystem.layer),
    BunRuntime.runMain
  );
}
