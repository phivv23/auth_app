CREATE TABLE IF NOT EXISTS story_views (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  story_id INT UNSIGNED NOT NULL,

  viewer_id INT UNSIGNED NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY story_views_story_viewer_unique (story_id, viewer_id),
  KEY story_views_viewer_id_index (viewer_id),

  CONSTRAINT story_views_story_id_fk
    FOREIGN KEY (story_id)
    REFERENCES stories(id)
    ON DELETE CASCADE,

  CONSTRAINT story_views_viewer_id_fk
    FOREIGN KEY (viewer_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
