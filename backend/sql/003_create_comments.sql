CREATE TABLE IF NOT EXISTS comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  post_id INT UNSIGNED NOT NULL,

  user_id INT UNSIGNED NOT NULL,

  content TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX comments_post_id_index (post_id),
  INDEX comments_user_id_index (user_id),

  CONSTRAINT comments_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE,

  CONSTRAINT comments_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;