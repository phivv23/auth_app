CREATE TABLE IF NOT EXISTS post_media (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  post_id INT UNSIGNED NOT NULL,

  media_url VARCHAR(500) NOT NULL,

  media_type VARCHAR(20) NOT NULL DEFAULT 'image',

  sort_order INT UNSIGNED NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX post_media_post_id_index (post_id),

  CONSTRAINT post_media_post_id_fk
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
