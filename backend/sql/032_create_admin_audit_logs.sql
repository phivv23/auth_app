CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id INT UNSIGNED NULL,
  target_user_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NULL,
  target_id INT UNSIGNED NULL,
  metadata_json TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX admin_audit_logs_actor_id_index (actor_id),
  INDEX admin_audit_logs_target_user_id_index (target_user_id),
  INDEX admin_audit_logs_action_index (action),
  INDEX admin_audit_logs_target_index (target_type, target_id),
  INDEX admin_audit_logs_created_at_index (created_at),
  CONSTRAINT admin_audit_logs_actor_id_fk
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT admin_audit_logs_target_user_id_fk
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
