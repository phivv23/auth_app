CREATE TABLE IF NOT EXISTS follows (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  follower_id INT UNSIGNED NOT NULL,

  following_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY follows_follower_id_following_id_unique (follower_id, following_id),

  INDEX follows_follower_id_index (follower_id),
  INDEX follows_following_id_index (following_id),

  CONSTRAINT follows_follower_id_fk
    FOREIGN KEY (follower_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT follows_following_id_fk
    FOREIGN KEY (following_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT follows_no_self_check
    CHECK (follower_id <> following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;