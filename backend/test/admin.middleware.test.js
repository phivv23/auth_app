import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAdminUser } from "../src/middleware/requireAdmin.js";

describe("admin middleware helpers", () => {
  it("accepts admin users", () => {
    assert.equal(isAdminUser({ role: "admin" }), true);
  });

  it("rejects non-admin users", () => {
    assert.equal(isAdminUser({ role: "user" }), false);
    assert.equal(isAdminUser(null), false);
  });
});
