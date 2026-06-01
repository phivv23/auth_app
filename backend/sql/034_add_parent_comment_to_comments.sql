ALTER TABLE comments
  ADD COLUMN parent_comment_id INT UNSIGNED NULL AFTER post_id,
  ADD INDEX comments_parent_comment_id_index (parent_comment_id),
  ADD CONSTRAINT comments_parent_comment_id_fk
    FOREIGN KEY (parent_comment_id)
    REFERENCES comments(id)
    ON DELETE CASCADE;
