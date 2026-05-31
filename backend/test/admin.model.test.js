import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateAdminRoleInput } from "../src/models/admin.model.js";

describe("admin model validation", () => {
  it("accepts supported admin role values", () => {
    assert.deepEqual(validateAdminRoleInput({ role: "admin" }), {
      value: {
        role: "admin",
      },
      error: null,
    });

    assert.deepEqual(validateAdminRoleInput({ role: "user" }), {
      value: {
        role: "user",
      },
      error: null,
    });
  });

  it("rejects unsupported role values", () => {
    const result = validateAdminRoleInput({ role: "owner" });

    assert.equal(result.value, null);
    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields), ["role"]);
  });
});
