import { Effect } from "effect";

/**
 * Shared backup utilities
 */

export interface BackupConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Find the available pg_dump binary path
 * Tries common variants like pg_dump, pg_dump-17, pg_dump-16, etc.
 */
export async function findPgDumpPath(): Promise<string | null> {
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  const pathsToTry = isLambda
    ? ["/opt/bin/pg_dump"]
    : [
        "pg_dump",
        "pg_dump-17",
        "pg_dump-16",
        "pg_dump-15",
        "pg_dump-14",
        "pg_dump-13",
      ];

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

/**
 * Check if Bun is available on the system
 */
export async function isBunAvailable(): Promise<boolean> {
  const bunPath = process.env.AWS_LAMBDA_FUNCTION_NAME
    ? "/opt/bin/bun"
    : "bun";

  try {
    const proc = Bun.spawn([bunPath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const isAvailable = proc.exitCode === 0;

    if (isAvailable) {
      const version = await new Response(proc.stdout).text();
      console.log(`✓ Bun runtime detected at ${bunPath}`);
      console.log(`  Version: ${version.trim()}`);
    } else {
      console.log(`⚠️  Bun not found at ${bunPath}`);
    }

    return isAvailable;
  } catch (error) {
    console.log(`⚠️  Bun not available at ${bunPath}`);
    return false;
  }
}

/**
 * Check if pg_dump is available on the system
 */
export async function isPgDumpAvailable(): Promise<boolean> {
  const pgDumpPath = await findPgDumpPath();

  if (!pgDumpPath) {
    console.log("⚠️  pg_dump not found in any common location");
    return false;
  }

  try {
    const proc = Bun.spawn([pgDumpPath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const isAvailable = proc.exitCode === 0;

    if (isAvailable) {
      const version = await new Response(proc.stdout).text();
      console.log(`✓ pg_dump found at ${pgDumpPath}`);
      console.log(`  Version: ${version.trim()}`);
    }

    return isAvailable;
  } catch (error) {
    console.log(`⚠️  pg_dump not available at ${pgDumpPath}`);
    return false;
  }
}

/**
 * Create a database backup using pg_dump
 */
export async function createBackupWithPgDump(config: BackupConfig): Promise<string> {
  console.log("📦 Creating database dump using pg_dump...");

  const pgDumpPath = await findPgDumpPath();

  if (!pgDumpPath) {
    throw new Error("pg_dump not found in any common location");
  }

  const env = {
    PGPASSWORD: config.password,
    PGUSER: config.user,
    PGHOST: config.host,
    PGDATABASE: config.database,
    PGPORT: config.port,
  };

  const proc = Bun.spawn([pgDumpPath, "--no-owner", "--no-acl", "--clean", "--if-exists"], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`pg_dump failed with exit code ${exitCode}: ${stderr}`);
  }

  if (stderr && !stderr.includes('NOTICE')) {
    console.warn("⚠️  pg_dump warnings:", stderr);
  }

  console.log(`✅ Database dump created (${(stdout.length / 1024).toFixed(2)} KB)`);
  return stdout;
}

/**
 * Log capture service for collecting console output during operations.
 * Uses Effect's Ref for state management and acquireRelease for cleanup.
 */
export interface LogCapture {
  readonly getLogs: Effect.Effect<string>;
}

export const makeLogCapture = Effect.sync(() => {
  const logs: string[] = [];

  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  const captureLog = (level: "log" | "error" | "warn", ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");

    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    logs.push(logEntry);
    originalConsole[level](...args);
  };

  console.log = (...args) => captureLog("log", ...args);
  console.error = (...args) => captureLog("error", ...args);
  console.warn = (...args) => captureLog("warn", ...args);

  const restore = () => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  };

  return {
    getLogs: Effect.sync(() => logs.join("\n")),
    restore,
  };
});

/**
 * Scoped log capture that automatically restores console on scope close.
 * Usage: Effect.scoped(withLogCapture((capture) => yourEffect))
 */
export const withLogCapture = <A, E, R>(
  fn: (capture: { getLogs: Effect.Effect<string> }) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    makeLogCapture,
    (capture) => fn({ getLogs: capture.getLogs }),
    (capture) => Effect.sync(() => capture.restore())
  );
