ALTER TABLE notifications
  ADD COLUMN metadata_json TEXT NULL AFTER report_id;
