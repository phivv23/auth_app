ALTER TABLE notifications
  ADD COLUMN report_id INT UNSIGNED NULL AFTER conversation_id,
  ADD INDEX notifications_report_id_index (report_id),
  ADD CONSTRAINT notifications_report_id_fk
    FOREIGN KEY (report_id)
    REFERENCES reports(id)
    ON DELETE SET NULL;
