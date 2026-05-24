ALTER TABLE conversations
  ADD COLUMN requester_id INT UNSIGNED NULL AFTER user_high_id,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'accepted' AFTER requester_id,
  ADD INDEX conversations_requester_id_index (requester_id),
  ADD INDEX conversations_status_index (status),
  ADD CONSTRAINT conversations_requester_id_fk
    FOREIGN KEY (requester_id)
    REFERENCES users(id)
    ON DELETE SET NULL;
