CREATE TABLE IF NOT EXISTS user_blocks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  blocker_id INT UNSIGNED NOT NULL,

  blocked_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY user_blocks_blocker_blocked_unique (blocker_id, blocked_id),

  KEY user_blocks_blocker_id_index (blocker_id),

  KEY user_blocks_blocked_id_index (blocked_id),

  CONSTRAINT user_blocks_blocker_id_fk
    FOREIGN KEY (blocker_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT user_blocks_blocked_id_fk
    FOREIGN KEY (blocked_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT user_blocks_no_self_check
    CHECK (blocker_id <> blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
