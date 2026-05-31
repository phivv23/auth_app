ALTER TABLE reports
  ADD COLUMN reviewed_by INT UNSIGNED NULL AFTER status,
  ADD COLUMN resolution_note TEXT NULL AFTER reviewed_by,
  ADD INDEX reports_reviewed_by_index (reviewed_by),
  ADD CONSTRAINT reports_reviewed_by_fk
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
