CREATE TABLE IF NOT EXISTS post_likes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  post_id INT UNSIGNED NOT NULL,

  user_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY post_likes_post_id_user_id_unique (post_id, user_id),

  INDEX post_likes_post_id_index (post_id),
  INDEX post_likes_user_id_index (user_id),

  CONSTRAINT post_likes_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE,

  CONSTRAINT post_likes_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;