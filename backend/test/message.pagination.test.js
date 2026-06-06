import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMessagePaginationMetadata } from "../src/models/message.model.js";

describe("message pagination metadata", () => {
  it("keeps legacy page metadata compatible", () => {
    const metadata = getMessagePaginationMetadata({
      messages: [{ id: 12 }, { id: 13 }],
      page: 2,
      limit: 10,
      total: 25,
    });

    assert.deepEqual(metadata, {
      page: 2,
      total: 25,
      totalPages: 3,
      hasMore: true,
      oldestMessageId: 12,
    });
  });

  it("supports cursor metadata without total counts", () => {
    const metadata = getMessagePaginationMetadata({
      messages: [{ id: 3 }, { id: 4 }],
      limit: 40,
      hasMore: false,
    });

    assert.deepEqual(metadata, {
      page: null,
      total: null,
      totalPages: null,
      hasMore: false,
      oldestMessageId: 3,
    });
  });
});
