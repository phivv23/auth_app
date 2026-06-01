import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateAdminAccountStatusInput,
  validateAdminContentActionInput,
  validateAdminRoleInput,
} from "../src/models/admin.model.js";

describe("admin model validation", () => {
  it("accepts supported admin role values", () => {
    assert.deepEqual(validateAdminRoleInput({ role: "admin" }), {
      value: {
        role: "admin",
      },
      error: null,
    });

    assert.deepEqual(validateAdminRoleInput({ role: "moderator" }), {
      value: {
        role: "moderator",
      },
      error: null,
    });

    assert.deepEqual(validateAdminRoleInput({ role: "super_admin" }), {
      value: {
        role: "super_admin",
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

  it("validates account status updates", () => {
    assert.deepEqual(
      validateAdminAccountStatusInput({
        accountStatus: "suspended",
        reason: "spam reports",
      }),
      {
        value: {
          accountStatus: "suspended",
          reason: "spam reports",
        },
        error: null,
      }
    );

    const result = validateAdminAccountStatusInput({
      accountStatus: "locked",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields), ["accountStatus"]);
  });

  it("validates admin content action notes", () => {
    const result = validateAdminContentActionInput({
      reason: "  spam  ",
      resolutionNote: "  removed by admin  ",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      reason: "spam",
      resolutionNote: "removed by admin",
    });

    const emptyResult = validateAdminContentActionInput({});

    assert.equal(emptyResult.error, null);
    assert.equal(emptyResult.value.reason, "Vi phạm quy định cộng đồng.");
  });
});
