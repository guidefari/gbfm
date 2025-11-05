import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { ScheduledEvent } from "aws-lambda";
import { Client } from "pg";

/**
 * Lambda-compatible Database Backup Handler
 *
 * This function creates a PostgreSQL database backup using the pg library
 * (without requiring pg_dump) and uploads it to S3.
 *
 * This is designed to run in AWS Lambda as part of a scheduled cron job.
 */

async function createBackup() {
  console.log("🔄 Starting database backup...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;

  const client = new Client({
    host: Resource.DatabaseHost.value,
    port: Number(Resource.DatabasePort.value),
    user: Resource.DatabaseUser.value,
    password: Resource.DatabasePassword.value,
    database: Resource.DatabaseName.value,
    ssl: false,
  });

  try {
    await client.connect();
    console.log("📦 Connected to database, generating backup...");

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    let sqlDump = "-- Database Backup\n";
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Database: ${Resource.DatabaseName.value}\n\n`;

    // For each table, get CREATE TABLE statement and data
    for (const row of tablesResult.rows) {
      const tableName = row.tablename;

      // Get table schema
      const schemaResult = await client.query(`
        SELECT
          'CREATE TABLE ' || quote_ident(tablename) || ' (' ||
          string_agg(
            quote_ident(attname) || ' ' ||
            format_type(atttypid, atttypmod) ||
            CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END,
            ', '
          ) || ');' as create_statement
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = $1
          AND n.nspname = 'public'
          AND a.attnum > 0
          AND NOT a.attisdropped
        GROUP BY tablename;
      `, [tableName]);

      sqlDump += `\n-- Table: ${tableName}\n`;
      sqlDump += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`;

      if (schemaResult.rows[0]?.create_statement) {
        sqlDump += schemaResult.rows[0].create_statement + '\n';
      }

      // Get table data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length > 0) {
        const columns = Object.keys(dataResult.rows[0]);
        const columnsList = columns.map((c) => `"${c}"`).join(', ');

        sqlDump += `\n-- Data for ${tableName}\n`;

        for (const dataRow of dataResult.rows) {
          const values = columns.map((col) => {
            const val = dataRow[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            // Escape single quotes in strings
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');

          sqlDump += `INSERT INTO "${tableName}" (${columnsList}) VALUES (${values});\n`;
        }
      }
    }

    const backupData = Buffer.from(sqlDump);
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
  } finally {
    await client.end();
  }
}

// Lambda handler for cron job
export const handler = async (event: ScheduledEvent) => {
  console.log("Lambda cron triggered:", event.time);

  try {
    const result = await createBackup();
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
