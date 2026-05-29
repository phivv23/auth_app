CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id INT UNSIGNED NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id INT UNSIGNED NOT NULL,
  reason VARCHAR(50) NOT NULL,
  details TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY reports_reporter_id_index (reporter_id),
  KEY reports_target_index (target_type, target_id),
  KEY reports_status_index (status),
  KEY reports_created_at_index (created_at),
  CONSTRAINT reports_reporter_id_fk
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT reports_target_type_check
    CHECK (target_type IN ('user', 'post', 'comment', 'message')),
  CONSTRAINT reports_status_check
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
