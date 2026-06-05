ALTER TABLE messages
  ADD INDEX messages_conversation_id_id_index (conversation_id, id);
