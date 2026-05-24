CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,

  last_read_message_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (conversation_id, user_id),
  INDEX conversation_members_user_id_index (user_id),
  INDEX conversation_members_last_read_message_id_index (last_read_message_id),

  CONSTRAINT conversation_members_conversation_id_fk
    FOREIGN KEY (conversation_id)
    REFERENCES conversations(id)
    ON DELETE CASCADE,

  CONSTRAINT conversation_members_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
