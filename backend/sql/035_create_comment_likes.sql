CREATE TABLE IF NOT EXISTS comment_likes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  comment_id INT UNSIGNED NOT NULL,

  user_id INT UNSIGNED NOT NULL,

  reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY comment_likes_comment_id_user_id_unique (comment_id, user_id),
  INDEX comment_likes_comment_id_index (comment_id),
  INDEX comment_likes_user_id_index (user_id),
  INDEX comment_likes_reaction_type_index (reaction_type),

  CONSTRAINT comment_likes_comment_id_fk
    FOREIGN KEY (comment_id)
    REFERENCES comments(id)
    ON DELETE CASCADE,

  CONSTRAINT comment_likes_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
