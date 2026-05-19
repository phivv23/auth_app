import { query } from "../db/pool.js";

/**
 * Tạo user mới.
 *
 * Function này chỉ quan tâm database.
 * Nó không validate, không hash password.
 * Validate/hash sẽ nằm ở route/controller.
 */
export async function createUser({ name, email, passwordHash }) {
  const result = await query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `,
    [name, email, passwordHash]
  );

  /**
   * Với INSERT, mysql2 trả về object có insertId.
   * insertId chính là id vừa được AUTO_INCREMENT tạo ra.
   */
  const insertedId = result.insertId;

  return findUserById(insertedId);
}

/**
 * Tìm user theo id.
 * Function này dùng cho /auth/me và sau khi register.
 *
 * Không select password_hash vì public user không cần password hash.
 */
export async function findUserById(id) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/**
 * Tìm user theo email.
 *
 * Function này dùng cho login.
 * Cần lấy password_hash để bcrypt.compare.
 */
export async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        password_hash AS passwordHash,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

/**
 * Tìm public user theo email.
 *
 * Function này dùng cho register để kiểm tra email đã tồn tại chưa.
 * Không cần lấy password_hash.
 */
export async function findPublicUserByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}
/**
 * Tìm user theo id nhưng có lấy passwordHash.
 *
 * Function này dùng cho change password.
 * Bình thường ta không lấy passwordHash khi trả user về frontend.
 * Nhưng khi đổi password, backend cần passwordHash cũ để bcrypt.compare().
 */
export async function findUserWithPasswordById(id) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url AS avatarUrl,
        password_hash AS passwordHash,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/**
 * Update profile user.
 *
 * Chỉ cho đổi name và email.
 * Không update password trong function này.
 */
export async function updateUserProfile(userId, { name, email }) {
  await query(
    `
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `,
    [name, email, userId]
  );

  /**
   * Sau khi update, query lại user mới nhất.
   * Function findUserById không trả passwordHash.
   */
  return findUserById(userId);
}

/**
 * Update avatar URL for current user.
 *
 * The route handles file upload and passes the saved public URL here.
 */
export async function updateUserAvatar(userId, avatarUrl) {
  await query(
    `
      UPDATE users
      SET avatar_url = ?
      WHERE id = ?
    `,
    [avatarUrl, userId]
  );

  return findUserById(userId);
}

/**
 * Update passwordHash.
 *
 * Password gốc không bao giờ được lưu vào database.
 * Route sẽ hash password mới trước, sau đó truyền passwordHash vào đây.
 */
export async function updateUserPassword(userId, passwordHash) {
  await query(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, userId]
  );
}

export async function findPublicUserProfileById(userId, currentUserId = null) {
  const viewerId = currentUserId || 0;

  const rows = await query(
    `
    SELECT
      u.id,
      u.name,
      u.avatar_url AS avatarUrl,
      u.created_at AS createdAt,

      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = u.id
      ) AS postCount,

      (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.following_id = u.id
      ) AS followerCount,

      (
        SELECT COUNT(*)
        FROM follows f
        WHERE f.follower_id = u.id
      ) AS followingCount,

      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = ? AND f.following_id = u.id
      ) AS isFollowing

    FROM users u
    WHERE u.id = ?
    `,
    [viewerId, userId]
  );

  const profile = rows[0] || null;

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    postCount: Number(profile.postCount),
    followerCount: Number(profile.followerCount),
    followingCount: Number(profile.followingCount),
    isFollowing: Boolean(profile.isFollowing),
    isMe: currentUserId ? Number(currentUserId) === Number(profile.id) : false,
  };
}
