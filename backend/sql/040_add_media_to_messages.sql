ALTER TABLE messages
  ADD COLUMN media_url VARCHAR(500) NULL AFTER content,
  ADD COLUMN media_type VARCHAR(20) NULL AFTER media_url,
  ADD COLUMN media_name VARCHAR(255) NULL AFTER media_type,
  ADD INDEX messages_media_type_index (media_type);
