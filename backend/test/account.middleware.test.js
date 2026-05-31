import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isActiveAccount } from "../src/middleware/requireActiveAccount.js";

describe("account restriction middleware helpers", () => {
  it("accepts active or legacy users", () => {
    assert.equal(isActiveAccount({ accountStatus: "active" }), true);
    assert.equal(isActiveAccount({}), true);
  });

  it("rejects restricted users", () => {
    assert.equal(isActiveAccount({ accountStatus: "suspended" }), false);
    assert.equal(isActiveAccount({ accountStatus: "banned" }), false);
  });
});
