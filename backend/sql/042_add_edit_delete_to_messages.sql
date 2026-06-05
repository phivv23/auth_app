ALTER TABLE messages
  ADD COLUMN edited_at TIMESTAMP NULL AFTER created_at,
  ADD COLUMN deleted_at TIMESTAMP NULL AFTER edited_at,
  ADD INDEX messages_deleted_at_index (deleted_at);
