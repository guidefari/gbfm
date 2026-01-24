#!/usr/bin/env bun

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { ScheduledEvent } from "aws-lambda";
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { BunFileSystem } from "@effect/platform-bun";
import { FileSystem } from "@effect/platform";
import { Effect, Console, Layer } from "effect";
import {
  isPgDumpAvailable,
  createBackupWithPgDump,
  type BackupConfig,
} from "./backup-utils";
import { sendBackupNotificationEmail } from "@gbfm/email/index";

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

class LogCapture {
  private logs: string[] = [];
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };
    
    console.log = (...args) => this.captureLog('log', ...args);
    console.error = (...args) => this.captureLog('error', ...args);
    console.warn = (...args) => this.captureLog('warn', ...args);
  }

  private captureLog(level: 'log' | 'error' | 'warn', ...args: any[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    this.logs.push(logEntry);
    
    // Also output to original console
    this.originalConsole[level](...args);
  }

  getLogs(): string {
    return this.logs.join('\n');
  }

  restore() {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
  }
}

async function sendNotificationEmail(
  status: 'success' | 'failure',
  config: BackupConfig,
  filename: string,
  backupSize: number,
  logs: string,
  errorMessage?: string,
  stackTrace?: string,
  _bucket?: string
) {
  try {



    
    await sendBackupNotificationEmail({
      to: "guidefari@icloud.com",
      status,
      timestamp: new Date().toISOString(),
      database: config.database,
      host: `${config.host}:${config.port}`,
      filename,
      fileSize: `${(backupSize / 1024 / 1024).toFixed(2)} MB`,
      errorMessage,
      stackTrace,
      logContent: logs,
      stage: process.env.SST_STAGE || 'dev'
    });
  } catch (emailError) {
    console.error("Failed to send notification email:", emailError);
  }
}

const destinationOption = Options.choice("destination", ["s3", "local"]).pipe(
  Options.withDescription("Where to save backup"),
  Options.withDefault("s3" as const)
);

const sourceBackupOption = Options.choice("source", ["local", "remote"]).pipe(
  Options.withDescription("Which database to backup"),
  Options.withDefault("remote" as const)
);


function createBackupEffect(destination: BackupDestination, backupSource: BackupSource) {
  return Effect.gen(function* (_) {
    // Set up log capture for this backup operation
    const logCapture = new LogCapture();
    
    yield* _(Console.log("🔄 Starting database backup..."));
    yield* _(Console.log(`   Source: ${backupSource} database`));
    yield* _(Console.log(`   Destination: ${destination === "s3" ? "S3 bucket" : "local filesystem"}`));
    yield* _(Console.log("   💡 Run with --help to see all available options\n"));

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;

    let config: BackupConfig;

    if (backupSource === "local") {
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

      // Send success notification
      yield* _(Effect.promise(() => 
        sendNotificationEmail(
          'success',
          config,
          filename,
          backupData.length,
          logCapture.getLogs(),
          undefined,
          undefined,
          bucketName
        )
      ));

      logCapture.restore();

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

      // Send success notification
      yield* _(Effect.promise(() => 
        sendNotificationEmail(
          'success',
          config,
          filename,
          backupData.length,
          logCapture.getLogs()
        )
      ));

      logCapture.restore();

      return {
        success: true,
        filename,
        path: filePath,
        size: backupData.length,
        method: hasPgDump ? "pg_dump" : "pg-library",
      } as BackupResult;
    }
  }).pipe(
    Effect.tapError((error) => {
      // Send failure notification on error
      return Effect.gen(function* (_) {
        yield* _(Effect.promise(() => 
          sendNotificationEmail(
            'failure',
            // Create a minimal config for error cases
            {
              password: "",
              user: "unknown",
              host: "unknown",
              database: "unknown",
              port: "5432",
            },
            "",
            0,
            "Error occurred during backup operation - see logs for details",
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined
          )
        ));
      });
    }),
    Effect.catchAll((error) =>
      Console.error(`❌ Backup failed: ${error}`).pipe(
        Effect.flatMap(() => Effect.fail(error))
      )
    )
  );
}

const backupCommand = Command.make(
  "backup",
  { destination: destinationOption, source: sourceBackupOption },
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
        Effect.provide(BunFileSystem.layer)
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
  const layers = Layer.merge(BunFileSystem.layer, BunContext.layer);
  cli(process.argv).pipe(
    Effect.provide(layers),
    BunRuntime.runMain
  );
}
