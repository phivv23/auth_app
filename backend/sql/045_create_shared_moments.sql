CREATE TABLE IF NOT EXISTS shared_moments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  creator_id INT UNSIGNED NOT NULL,

  title VARCHAR(120) NOT NULL,
  note TEXT NULL,
  mood VARCHAR(40) NULL,
  cover_media_url VARCHAR(500) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX shared_moments_creator_id_index (creator_id),
  INDEX shared_moments_updated_at_index (updated_at),

  CONSTRAINT shared_moments_creator_id_fk
    FOREIGN KEY (creator_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
