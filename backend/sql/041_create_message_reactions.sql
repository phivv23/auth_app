CREATE TABLE IF NOT EXISTS message_reactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  reaction VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY message_reactions_message_user_unique (message_id, user_id),
  INDEX message_reactions_message_id_index (message_id),
  CONSTRAINT message_reactions_message_fk
    FOREIGN KEY (message_id) REFERENCES messages(id)
    ON DELETE CASCADE,
  CONSTRAINT message_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
