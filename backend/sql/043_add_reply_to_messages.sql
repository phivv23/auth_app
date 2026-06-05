ALTER TABLE messages
  ADD COLUMN reply_to_message_id INT UNSIGNED NULL AFTER media_name,
  ADD INDEX messages_reply_to_message_id_index (reply_to_message_id),
  ADD CONSTRAINT messages_reply_to_message_fk
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id)
    ON DELETE SET NULL;
