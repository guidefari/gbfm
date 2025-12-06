#!/usr/bin/env bun

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { BunFileSystem } from "@effect/platform-bun";
import { Effect, Console, Layer } from "effect";
import { existsSync } from "node:fs";
import path from "node:path";


interface RestoreConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

async function findPsqlPath(): Promise<string | null> {
  const pathsToTry = ["psql", "psql-17", "psql-16", "psql-15", "psql-14", "psql-13"];

  for (const path of pathsToTry) {
    try {
      const proc = Bun.spawn([path, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;

      if (proc.exitCode === 0) {
        return path;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function isPsqlAvailable(): Promise<boolean> {
  const psqlPath = await findPsqlPath();
  return psqlPath !== null;
}

async function restoreWithPsql(config: RestoreConfig, filePath: string): Promise<void> {
  console.log("📦 Restoring database using psql...");

  const psqlPath = await findPsqlPath();
  if (!psqlPath) {
    throw new Error("psql not found");
  }

  const env = {
    PGPASSWORD: config.password,
    PGUSER: config.user,
    PGHOST: config.host,
    PGDATABASE: config.database,
    PGPORT: config.port,
  };

  const proc = Bun.spawn([psqlPath, "-f", filePath], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`psql failed with exit code ${exitCode}: ${stderr}`);
  }

  if (stdout) {
    console.log(stdout);
  }

  if (stderr && !stderr.includes('NOTICE')) {
    console.warn("⚠️  psql warnings:", stderr);
  }

  console.log("✅ Database restored successfully using psql");
}

async function getLatestS3Backup(): Promise<{ key: string; filePath: string }> {
  const s3Client = new S3Client({});

  const getBucketName = (): string => {
    try {
      return (Resource as any).DatabaseBackups?.name || process.env.DATABASE_BACKUP_BUCKET || "";
    } catch {
      return process.env.DATABASE_BACKUP_BUCKET || "";
    }
  };

  const bucketName = getBucketName();

  if (!bucketName) {
    throw new Error("Database backup bucket not configured");
  }

  console.log(`📦 Fetching latest backup from S3 bucket: ${bucketName}`);

  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    MaxKeys: 100,
  });

  const listResponse = await s3Client.send(listCommand);

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    throw new Error("No backups found in S3 bucket");
  }

  const sortedBackups = listResponse.Contents
    .filter(obj => obj.Key && obj.Key.endsWith('.sql'))
    .sort((a, b) => {
      const timeA = a.LastModified?.getTime() || 0;
      const timeB = b.LastModified?.getTime() || 0;
      return timeB - timeA;
    });

  if (sortedBackups.length === 0) {
    throw new Error("No .sql backup files found in S3 bucket");
  }

  const latestBackup = sortedBackups[0];

  if (!latestBackup) {
    throw new Error("No backups found in S3 bucket");
  }
  
  console.log(`✅ Latest backup: ${latestBackup.Key}`);
  console.log(`   Created: ${latestBackup.LastModified?.toISOString()}`);
  console.log(`   Size: ${((latestBackup.Size || 0) / 1024 / 1024).toFixed(2)} MB`);

  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: latestBackup.Key,
  });

  const getResponse = await s3Client.send(getCommand);
  const content = await getResponse.Body?.transformToString() || "";

  // Save to temp file
  const tempDir = path.join(process.cwd(), ".tmp");
  const tempFilePath = path.join(tempDir, `restore-${Date.now()}.sql`);

  // Create temp directory if it doesn't exist
  await Bun.write(tempFilePath, content);

  console.log(`💾 Downloaded to: ${tempFilePath}`);

  return { key: latestBackup.Key!, filePath: tempFilePath };
}

function promptConfirmation(config: RestoreConfig, source: string): boolean {
  console.log("\n⚠️  WARNING: DESTRUCTIVE OPERATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Source: ${source}`);
  console.log(`Target database: ${config.database}`);
  console.log(`Host: ${config.host}:${config.port}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("This operation will:");
  console.log("  • DROP existing tables");
  console.log("  • DELETE all current data");
  console.log("  • REPLACE with backup data");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const response = prompt("Type 'yes' to continue: ");
  return response?.toLowerCase() === 'yes';
}

const sourceOption = Options.text("source").pipe(
  Options.withDescription("Source of backup: 's3' for latest S3 backup, or file path"),
  Options.withDefault("s3" as const)
);

const destinationOption = Options.choice("destination", ["local", "remote"]).pipe(
  Options.withDescription("Which database to restore to"),
  Options.withDefault("local" as const)
);

const skipConfirmOption = Options.boolean("skip-confirm").pipe(
  Options.withDescription("Skip confirmation prompt (use with caution!)"),
  Options.withDefault(false)
);

const restoreCommand = Command.make(
  "restore",
  { source: sourceOption, destination: destinationOption, skipConfirm: skipConfirmOption },
  ({ source, destination, skipConfirm }) =>
    Effect.gen(function* (_) {
      yield* _(Console.log("🔄 Starting database restore..."));
      yield* _(Console.log(`   Source: ${source}`));
      yield* _(Console.log(`   Destination: ${destination} database`));
      yield* _(Console.log("   💡 Run with --help to see all available options\n"));

      let filePath: string;
      let sourceName: string;
      let isTemporaryFile = false;

      if (source === "s3") {
        const { key, filePath: tempPath } = yield* _(Effect.promise(() => getLatestS3Backup()));
        filePath = tempPath;
        sourceName = `S3: ${key}`;
        isTemporaryFile = true;
      } else {
        const resolvedPath = path.isAbsolute(source)
          ? source
          : path.join(process.cwd(), source);

        if (!existsSync(resolvedPath)) {
          yield* _(Console.error(`❌ Error: File not found: ${resolvedPath}`));
          return yield* _(Effect.fail(new Error("File not found")));
        }

        yield* _(Console.log(`📁 Backup file: ${resolvedPath}`));
        const fileSize = yield* _(Effect.promise(async () => Bun.file(resolvedPath).size));
        yield* _(Console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`));

        filePath = resolvedPath;
        sourceName = resolvedPath;
      }

      let config: RestoreConfig;

      if (destination === "local") {
        const localDbUrl = process.env.LOCAL_DB_URL;
        if (!localDbUrl) {
          yield* _(Console.error("❌ LOCAL_DB_URL environment variable is required when using --destination=local"));
          yield* _(Console.error("   Format: postgres://user:password@host:port/database"));
          return yield* _(Effect.fail(new Error("LOCAL_DB_URL not set")));
        }

        yield* _(Console.log("🔗 Using LOCAL_DB_URL connection string"));
        const url = new URL(localDbUrl);
        
        yield* _(Console.log(url.toString()));

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

      if (!skipConfirm) {
        const confirmed = promptConfirmation(config, sourceName);
        if (!confirmed) {
          yield* _(Console.log("❌ Restore cancelled by user"));
          return yield* _(Effect.succeed(undefined));
        }
      }

      yield* _(Console.log("\n🚀 Starting restore operation..."));

      const hasPsql = yield* _(Effect.promise(() => isPsqlAvailable()));

      if (!hasPsql) {
        if (isTemporaryFile) {
          yield* _(Effect.promise(async () => {
            const fs = await import("node:fs/promises");
            await fs.unlink(filePath).catch(() => {});
          }));
        }
        yield* _(Console.log("⚠️  psql not found, exiting"));
        return yield* _(Effect.fail(new Error("psql not available")));
      }

      yield* _(Console.log("✓ Using psql"));

      try {
        yield* _(Effect.promise(() => restoreWithPsql(config, filePath)));

        yield* _(Console.log("\n🎉 Database restore complete!"));
        yield* _(Console.log(`📊 Database: ${config.database}`));
        yield* _(Console.log(`📊 User: ${config.user}`));
        yield* _(Console.log(`📊 Password: ${config.password}`));
        yield* _(Console.log(`   Host: ${config.host}:${config.port}`));
      } finally {
        // Clean up temp file if it was from S3
        if (isTemporaryFile) {
          yield* _(Effect.promise(async () => {
            const fs = await import("node:fs/promises");
            await fs.unlink(filePath).catch(() => {});
            console.log(`🧹 Cleaned up temp file: ${filePath}`);
          }));
        }
      }

      return yield* _(Effect.succeed(undefined));
    }).pipe(
      Effect.catchAll((error) =>
        Console.error(`❌ Restore failed: ${error}`).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      )
    )
).pipe(
  Command.withDescription("Restore a PostgreSQL database from S3 or local backup file")
);

const cli = Command.run(restoreCommand, {
  name: "Database Restore",
  version: "1.0.0",
});

if (import.meta.main) {
  const layers = Layer.merge(BunFileSystem.layer, BunContext.layer);
  cli(process.argv).pipe(
    Effect.provide(layers),
    BunRuntime.runMain
  );
}
