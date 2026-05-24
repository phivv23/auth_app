CREATE TABLE IF NOT EXISTS conversations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_low_id INT UNSIGNED NOT NULL,
  user_high_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY conversations_user_pair_unique (user_low_id, user_high_id),
  INDEX conversations_updated_at_index (updated_at),

  CONSTRAINT conversations_user_low_id_fk
    FOREIGN KEY (user_low_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT conversations_user_high_id_fk
    FOREIGN KEY (user_high_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT conversations_no_self_check
    CHECK (user_low_id <> user_high_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
