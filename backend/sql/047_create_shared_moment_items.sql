CREATE TABLE IF NOT EXISTS shared_moment_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  moment_id INT UNSIGNED NOT NULL,
  item_type VARCHAR(20) NOT NULL,
  post_id INT UNSIGNED NULL,
  story_id INT UNSIGNED NULL,
  message_id INT UNSIGNED NULL,
  conversation_id INT UNSIGNED NULL,
  content TEXT NULL,
  media_url VARCHAR(500) NULL,
  media_type VARCHAR(20) NULL,
  created_by_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX shared_moment_items_moment_created_index (moment_id, created_at),
  INDEX shared_moment_items_created_by_index (created_by_id),
  INDEX shared_moment_items_post_id_index (post_id),
  INDEX shared_moment_items_story_id_index (story_id),
  INDEX shared_moment_items_message_id_index (message_id),

  CONSTRAINT shared_moment_items_moment_id_fk
    FOREIGN KEY (moment_id)
    REFERENCES shared_moments(id)
    ON DELETE CASCADE,

  CONSTRAINT shared_moment_items_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE SET NULL,

  CONSTRAINT shared_moment_items_story_id_fk
    FOREIGN KEY (story_id)
    REFERENCES stories(id)
    ON DELETE SET NULL,

  CONSTRAINT shared_moment_items_message_id_fk
    FOREIGN KEY (message_id)
    REFERENCES messages(id)
    ON DELETE SET NULL,

  CONSTRAINT shared_moment_items_conversation_id_fk
    FOREIGN KEY (conversation_id)
    REFERENCES conversations(id)
    ON DELETE SET NULL,

  CONSTRAINT shared_moment_items_created_by_id_fk
    FOREIGN KEY (created_by_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT shared_moment_items_type_check
    CHECK (item_type IN ('post', 'story', 'message', 'note'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
