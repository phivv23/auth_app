CREATE TABLE IF NOT EXISTS post_bookmarks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_id INT UNSIGNED NOT NULL,

  post_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY post_bookmarks_user_post_unique (user_id, post_id),

  KEY post_bookmarks_user_id_index (user_id),

  KEY post_bookmarks_post_id_index (post_id),

  CONSTRAINT post_bookmarks_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT post_bookmarks_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
