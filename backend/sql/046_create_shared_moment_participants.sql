CREATE TABLE IF NOT EXISTS shared_moment_participants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  moment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  invited_by_id INT UNSIGNED NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY shared_moment_participants_unique (moment_id, user_id),
  INDEX shared_moment_participants_user_status_index (user_id, status),
  INDEX shared_moment_participants_moment_status_index (moment_id, status),

  CONSTRAINT shared_moment_participants_moment_id_fk
    FOREIGN KEY (moment_id)
    REFERENCES shared_moments(id)
    ON DELETE CASCADE,

  CONSTRAINT shared_moment_participants_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT shared_moment_participants_invited_by_id_fk
    FOREIGN KEY (invited_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT shared_moment_participants_status_check
    CHECK (status IN ('pending', 'accepted', 'declined'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
