#!/usr/bin/env bun

import { Resource } from "sst";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Database Restore Script
 *
 * This script restores a PostgreSQL database from a SQL dump file.
 * WARNING: This will drop existing tables and data!
 *
 * Usage:
 *   bun run scripts/restore-db.ts <path-to-backup.sql>
 *
 * Environment Variables:
 *   LOCAL_DB_URL - Optional local database connection string
 *                  Format: postgres://user:password@host:port/database
 *   SKIP_CONFIRM - Skip confirmation prompt (use with caution!)
 *
 * Examples:
 *   # Restore to SST database
 *   bun run scripts/restore-db.ts backups/backup-2025-11-14T12-30-00-000Z.sql
 *
 *   # Restore to local database
 *   LOCAL_DB_URL=postgres://user:password@localhost:5432/mydb bun run scripts/restore-db.ts backup.sql
 *
 *   # Skip confirmation (automated scripts)
 *   SKIP_CONFIRM=1 bun run scripts/restore-db.ts backup.sql
 */

interface RestoreConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

async function isPsqlAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "psql"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

async function restoreWithPsql(config: RestoreConfig, filePath: string): Promise<void> {
  console.log("📦 Restoring database using psql...");

  const env = {
    PGPASSWORD: config.password,
    PGUSER: config.user,
    PGHOST: config.host,
    PGDATABASE: config.database,
    PGPORT: config.port,
  };

  const proc = Bun.spawn(["psql", "-f", filePath], {
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

async function restoreWithPg(config: RestoreConfig, filePath: string): Promise<void> {
  console.log("📦 Restoring database using pg library...");

  const client = new Client({
    host: config.host,
    port: Number(config.port),
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: false,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Read the SQL file
    const sqlContent = await readFile(filePath, 'utf-8');

    // Split into individual statements (simple split by semicolon)
    // This is a basic implementation - psql is more robust
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    let executed = 0;
    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
        if (executed % 100 === 0) {
          console.log(`   Progress: ${executed}/${statements.length} statements`);
        }
      } catch (error) {
        console.warn(`⚠️  Warning executing statement: ${error}`);
        // Continue with other statements
      }
    }

    console.log(`✅ Executed ${executed}/${statements.length} statements successfully`);
  } finally {
    await client.end();
  }
}

async function promptConfirmation(config: RestoreConfig, filePath: string): Promise<boolean> {
  console.log("\n⚠️  WARNING: DESTRUCTIVE OPERATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`This will restore from: ${filePath}`);
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

async function restoreDatabase() {
  console.log("🔄 Starting database restore...");

  // Get file path from command line arguments
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("❌ Error: No backup file specified");
    console.log("\nUsage:");
    console.log("  bun run scripts/restore-db.ts <path-to-backup.sql>");
    console.log("\nExample:");
    console.log("  bun run scripts/restore-db.ts backups/backup-2025-11-14T12-30-00-000Z.sql");
    process.exit(1);
  }

  // Resolve file path (handle relative paths)
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📁 Backup file: ${resolvedPath}`);

  // Get file size
  const fileSize = (await Bun.file(resolvedPath).size);
  console.log(`📦 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  try {
    let config: RestoreConfig;

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

    // Prompt for confirmation unless SKIP_CONFIRM is set
    if (!process.env.SKIP_CONFIRM) {
      const confirmed = await promptConfirmation(config, resolvedPath);
      if (!confirmed) {
        console.log("❌ Restore cancelled by user");
        process.exit(0);
      }
    }

    console.log("\n🚀 Starting restore operation...");

    // Check if psql is available
    const hasPsql = await isPsqlAvailable();

    if (hasPsql) {
      console.log("✓ Using psql (recommended)");
      await restoreWithPsql(config, resolvedPath);
    } else {
      console.log("⚠️  psql not found, using pure Node.js restore");
      console.log("   Install PostgreSQL client tools for better restore quality:");
      console.log("   - macOS: brew install postgresql");
      console.log("   - Ubuntu/Debian: sudo apt-get install postgresql-client");
      console.log("   - Windows: Download from postgresql.org\n");
      await restoreWithPg(config, resolvedPath);
    }

    console.log("\n🎉 Database restore complete!");
    console.log(`📊 Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
  } catch (error) {
    console.error("\n❌ Restore failed:", error);
    throw error;
  }
}

// Direct execution
if (import.meta.main) {
  restoreDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
