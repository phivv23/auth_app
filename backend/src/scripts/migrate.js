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

async function migrate() {
  try {
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

    for (const file of sqlFiles) {
      const filePath = path.join(sqlDir, file);
      const sql = await fs.readFile(filePath, "utf8");

      console.log(`Running migration: ${file}`);

      /**
       * Chạy SQL trong file.
       * Ở đây file chỉ có một CREATE TABLE nên execute là đủ.
       */
      try {
        await pool.execute(sql);
      } catch (error) {
        if (error.code === "ER_DUP_FIELDNAME") {
          console.log(`Skipping migration ${file}: column already exists.`);
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
