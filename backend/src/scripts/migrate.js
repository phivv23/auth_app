import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db/pool.js";

/**
 * __dirname không có sẵn trong ES Modules.
 * Hai dòng này tạo lại __dirname tương đương CommonJS.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File này nằm ở:
 * backend/src/scripts/migrate.js
 *
 * Folder sql nằm ở:
 * backend/sql
 *
 * Vì vậy đi ngược lên 2 cấp: src/scripts -> src -> backend.
 */
const sqlDir = path.join(__dirname, "../../sql");

const duplicateMigrationErrorCodes = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_FK_DUP_NAME",
]);

async function ensureMigrationTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations() {
  const [rows] = await pool.execute(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );

  return new Set(rows.map((row) => row.filename));
}

async function markMigrationApplied(file) {
  await pool.execute(
    "INSERT IGNORE INTO schema_migrations (filename) VALUES (?)",
    [file]
  );
}

async function migrate() {
  try {
    await ensureMigrationTable();

    const files = await fs.readdir(sqlDir);

    /**
     * Lấy các file .sql và sort theo tên.
     * Ví dụ:
     * 001_create_users.sql
     * 002_create_posts.sql
     */
    const sqlFiles = files
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const appliedMigrations = await getAppliedMigrations();

    for (const file of sqlFiles) {
      if (appliedMigrations.has(file)) {
        console.log(`Skipping migration: ${file} already applied.`);
        continue;
      }

      const filePath = path.join(sqlDir, file);
      const sql = await fs.readFile(filePath, "utf8");

      console.log(`Running migration: ${file}`);

      /**
       * Chạy SQL trong file.
       * Ở đây file chỉ có một CREATE TABLE nên execute là đủ.
       */
      try {
        await pool.execute(sql);
        await markMigrationApplied(file);
      } catch (error) {
        if (duplicateMigrationErrorCodes.has(error.code)) {
          console.log(
            `Marking migration ${file} as applied: ${error.message}`
          );
          await markMigrationApplied(file);
          continue;
        }

        throw error;
      }
    }

    console.log("Migrations completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    /**
     * Đóng pool để Node process thoát.
     */
    await pool.end();
  }
}

migrate();
