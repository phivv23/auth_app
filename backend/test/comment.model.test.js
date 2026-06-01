import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCommentTree } from "../src/models/comment.model.js";

describe("comment model helpers", () => {
  it("groups replies under top-level comments", () => {
    const comments = buildCommentTree([
      { id: 1, parentCommentId: null, content: "root", replyCount: 0 },
      { id: 2, parentCommentId: 1, content: "reply", replyCount: 0 },
    ]);

    assert.equal(comments.length, 1);
    assert.equal(comments[0].replyCount, 1);
    assert.deepEqual(
      comments[0].replies.map((reply) => reply.id),
      [2]
    );
  });

  it("keeps orphan replies visible as root comments", () => {
    const comments = buildCommentTree([
      { id: 2, parentCommentId: 99, content: "orphan", replyCount: 0 },
    ]);

    assert.equal(comments.length, 1);
    assert.equal(comments[0].id, 2);
    assert.deepEqual(comments[0].replies, []);
  });
});
