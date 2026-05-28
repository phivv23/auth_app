import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getBlockFilterSql,
  getBlockStatusParams,
  getBlockStatusSelectSql,
} from "../src/models/block.model.js";

describe("block model SQL helpers", () => {
  it("does not add a block filter for anonymous viewers", () => {
    const filter = getBlockFilterSql({
      currentUserId: null,
      userAlias: "u",
    });

    assert.equal(filter.sql, "1 = 1");
    assert.deepEqual(filter.params, []);
  });

  it("builds a two-way block filter for authenticated viewers", () => {
    const filter = getBlockFilterSql({
      currentUserId: 42,
      userAlias: "profile_user",
    });

    assert.match(filter.sql, /user_blocks visibility_block/);
    assert.match(filter.sql, /profile_user\.id/);
    assert.deepEqual(filter.params, [42, 42]);
  });

  it("builds block status select aliases and params", () => {
    const selectSql = getBlockStatusSelectSql("candidate");

    assert.match(selectSql, /AS blockedByMe/);
    assert.match(selectSql, /AS hasBlockedMe/);
    assert.match(selectSql, /candidate\.id/);
    assert.deepEqual(getBlockStatusParams(7), [7, 7]);
  });
});
