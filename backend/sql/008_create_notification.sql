CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  recipient_id INT UNSIGNED NOT NULL,
  actor_id INT UNSIGNED NULL,

  type VARCHAR(50) NOT NULL,

  post_id INT UNSIGNED NULL,
  comment_id INT UNSIGNED NULL,

  is_read TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX notifications_recipient_id_index (recipient_id),
  INDEX notifications_actor_id_index (actor_id),
  INDEX notifications_type_index (type),
  INDEX notifications_is_read_index (is_read),
  INDEX notifications_created_at_index (created_at),
  INDEX notifications_post_id_index (post_id),
  INDEX notifications_comment_id_index (comment_id),

  CONSTRAINT notifications_recipient_id_fk
    FOREIGN KEY (recipient_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT notifications_actor_id_fk
    FOREIGN KEY (actor_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT notifications_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE,

  CONSTRAINT notifications_comment_id_fk
    FOREIGN KEY (comment_id)
    REFERENCES comments(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;