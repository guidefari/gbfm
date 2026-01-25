import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sendBackupNotificationEmail } from "@gbfm/email/index";
import { Console, Effect } from "effect";
import { config } from "../src/services/config.service";
import {
  type BackupConfig,
  createBackupWithPgDump,
  isPgDumpAvailable,
  withLogCapture,
} from "./backup-utils";
import { EmailError } from "../src/errors";

/**
 * Task Entrypoint for Database Backup
 *
 * This script runs inside an ECS Task (not Lambda)
 * It has access to pg_dump via the Docker image
 */

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
        to: "guidefari@icloud.com",
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
            emailAddress: "guidefari@icloud.com" 
          })
        : new EmailError({ 
            message: `Failed to send email: Unknown error: ${String(error)}`, 
            emailAddress: "guidefari@icloud.com" 
          }),
  }).pipe(
    Effect.tap(() => Console.log(`📧 Notification email sent (${status})`)),
    Effect.catchAll((error) =>
      Console.error(`Failed to send notification email: ${error}`)
    )
  );

const createBackupEffect = withLogCapture((capture) =>
  Effect.gen(function* (_) {
    yield* _(Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    yield* _(Console.log("🚀 Database Backup Task Started"));
    yield* _(Console.log(`   Timestamp: ${new Date().toISOString()}`));
    yield* _(Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;

    const backupConfig: BackupConfig = {
      password: config.database.password,
      user: config.database.user,
      host: config.database.host,
      database: config.database.name,
      port: config.database.port.toString(),
    };

    yield* _(Console.log("📊 Database Configuration:"));
    yield* _(Console.log(`   Database: ${backupConfig.database}`));
    yield* _(Console.log(`   Host: ${backupConfig.host}:${backupConfig.port}`));
    yield* _(Console.log(`   User: ${backupConfig.user}`));

    yield* _(Console.log("\n🔍 Checking for backup tools..."));
    const hasPgDump = yield* _(Effect.promise(() => isPgDumpAvailable()));

    if (!hasPgDump) {
      const error = new Error("pg_dump not found in Docker container");
      const logs = yield* _(capture.getLogs);
      yield* _(
        sendNotificationEmail(
          "failure",
          backupConfig,
          filename,
          0,
          logs,
          error.message,
          error.stack
        )
      );
      return yield* _(Effect.fail(error));
    }

    yield* _(Console.log("\n📦 Using pg_dump for backup"));
    const sqlDump = yield* _(
      Effect.promise(() => createBackupWithPgDump(backupConfig))
    );

    const backupData = Buffer.from(sqlDump);
    const backupSizeMB = (backupData.length / 1024 / 1024).toFixed(2);
    yield* _(Console.log(`\n✅ Backup created successfully`));
    yield* _(Console.log(`   Size: ${backupSizeMB} MB`));
    yield* _(Console.log(`   Filename: ${filename}`));

    yield* _(Console.log("\n☁️  Uploading to S3..."));
    const s3Client = new S3Client({});
    const bucketName = config.buckets.databaseBackups;

    yield* _(
      Effect.promise(() =>
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
              source: "ecs-task",
            },
          })
        )
      )
    );

    yield* _(Console.log(`\n✅ Upload successful!`));
    yield* _(Console.log(`   Bucket: ${bucketName}`));
    yield* _(Console.log(`   Key: ${filename}`));
    yield* _(Console.log(`   Size: ${backupSizeMB} MB`));

    yield* _(Console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    yield* _(Console.log("✅ Backup Task Completed Successfully"));
    yield* _(Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

    const logs = yield* _(capture.getLogs);
    yield* _(
      sendNotificationEmail(
        "success",
        backupConfig,
        filename,
        backupData.length,
        logs
      )
    );

    return {
      success: true,
      filename,
      bucket: bucketName,
      size: backupData.length,
      method: "pg_dump",
    };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* (_) {
        yield* _(Console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        yield* _(Console.error("❌ Backup Task Failed"));
        yield* _(Console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        yield* _(Console.error(`Error details: ${error}`));
        return yield* _(Effect.fail(error));
      })
    )
  )
);

const program = createBackupEffect.pipe(
  Effect.match({
    onSuccess: () => process.exit(0),
    onFailure: (error) => {
      console.error("Backup failed:", error);
      process.exit(1);
    },
  })
);

Effect.runPromise(program);
