CREATE TABLE IF NOT EXISTS stories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_id INT UNSIGNED NOT NULL,

  media_url VARCHAR(500) NOT NULL,

  media_type VARCHAR(20) NOT NULL DEFAULT 'image',

  caption VARCHAR(500) NULL,

  privacy VARCHAR(20) NOT NULL DEFAULT 'friends',

  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY stories_user_id_index (user_id),
  KEY stories_expires_at_index (expires_at),
  KEY stories_user_expires_index (user_id, expires_at),

  CONSTRAINT stories_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT stories_privacy_check
    CHECK (privacy IN ('public', 'followers', 'friends', 'only_me'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
