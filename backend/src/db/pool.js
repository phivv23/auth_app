import mysql from "mysql2/promise";
import { env } from "../config/env.js";

/**
 * Pool là nhóm connection MySQL được tái sử dụng.
 *
 * Nếu mỗi request mở một connection mới rồi đóng ngay,
 * app sẽ chậm và tốn tài nguyên.
 *
 * createPool giúp backend tái sử dụng connection cũ.
 */
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  timezone: "Z",

  // Nếu hết connection đang rảnh, request sẽ chờ.
  waitForConnections: true,

  // Số connection tối đa trong pool.
  connectionLimit: 10,

  // Số request được xếp hàng chờ connection.
  // 0 nghĩa là không giới hạn.
  queueLimit: 0,
});

/**
 * Helper chạy SQL.
 *
 * Dùng pool.execute thay vì nối string SQL thủ công.
 * Với user input, luôn dùng placeholder ? để giảm rủi ro SQL injection.
 *
 * Ví dụ:
 * query("SELECT * FROM users WHERE email = ?", [email])
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
