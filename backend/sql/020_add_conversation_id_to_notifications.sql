ALTER TABLE notifications
  ADD COLUMN conversation_id INT UNSIGNED NULL AFTER comment_id,
  ADD INDEX notifications_conversation_id_index (conversation_id),
  ADD CONSTRAINT notifications_conversation_id_fk
    FOREIGN KEY (conversation_id)
    REFERENCES conversations(id)
    ON DELETE CASCADE;
