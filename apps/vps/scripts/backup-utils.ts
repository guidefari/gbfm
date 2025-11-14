import { Client } from "pg";

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
 * Check if pg_dump is available on the system
 */
export async function isPgDumpAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "pg_dump"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Create a database backup using pure Node.js/pg library
 * This doesn't require pg_dump to be installed
 */
export async function createBackupWithPg(config: BackupConfig): Promise<string> {
  console.log("📦 Creating database dump using pg library...");

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

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    let sqlDump = "-- Database Backup\n";
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Database: ${config.database}\n`;
    sqlDump += `-- Method: pg library (pure Node.js)\n\n`;

    // For each table, get CREATE TABLE statement and data
    for (const row of tablesResult.rows) {
      const tableName = row.tablename;

      // Get column information
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      sqlDump += `\n-- Table: ${tableName}\n`;
      sqlDump += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;

      // Build CREATE TABLE statement
      if (columnsResult.rows.length > 0) {
        const columnDefs = columnsResult.rows.map((col) => {
          let def = `"${col.column_name}" ${col.data_type}`;
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
          }
          return def;
        }).join(',\n  ');

        sqlDump += `CREATE TABLE "${tableName}" (\n  ${columnDefs}\n);\n`;
      }

      // Get table data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length > 0) {
        const columns = Object.keys(dataResult.rows[0]);
        const columnsList = columns.map((c) => `"${c}"`).join(', ');

        sqlDump += `\n-- Data for ${tableName} (${dataResult.rows.length} rows)\n`;

        for (const dataRow of dataResult.rows) {
          const values = columns.map((col) => {
            const val = dataRow[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            // Escape single quotes in strings
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');

          sqlDump += `INSERT INTO "${tableName}" (${columnsList}) VALUES (${values});\n`;
        }
      }
    }

    console.log(`✅ Database dump created (${(sqlDump.length / 1024).toFixed(2)} KB)`);
    return sqlDump;
  } finally {
    await client.end();
  }
}

/**
 * Create a database backup using pg_dump
 */
export async function createBackupWithPgDump(config: BackupConfig): Promise<string> {
  console.log("📦 Creating database dump using pg_dump...");

  const env = {
    PGPASSWORD: config.password,
    PGUSER: config.user,
    PGHOST: config.host,
    PGDATABASE: config.database,
    PGPORT: config.port,
  };

  const proc = Bun.spawn(["pg_dump", "--no-owner", "--no-acl", "--clean", "--if-exists"], {
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
