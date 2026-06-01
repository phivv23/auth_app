import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAdminUser,
  isModeratorUser,
  isSuperAdminUser,
  requireAdmin,
  requireModerator,
  requireSuperAdmin,
} from "../src/middleware/requireAdmin.js";

function createMockResponse() {
  return {
    statusCode: null,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function runMiddleware(middleware, role) {
  const res = createMockResponse();
  let nextCalled = false;

  middleware({ user: { role } }, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

describe("admin middleware helpers", () => {
  it("accepts content admin users", () => {
    assert.equal(isAdminUser({ role: "admin" }), true);
    assert.equal(isAdminUser({ role: "super_admin" }), true);
    assert.equal(isAdminUser({ role: "moderator" }), false);
  });

  it("rejects non-admin users", () => {
    assert.equal(isAdminUser({ role: "user" }), false);
    assert.equal(isAdminUser(null), false);
  });

  it("accepts all moderation staff for report handling", () => {
    assert.equal(isModeratorUser({ role: "moderator" }), true);
    assert.equal(isModeratorUser({ role: "admin" }), true);
    assert.equal(isModeratorUser({ role: "super_admin" }), true);
    assert.equal(isModeratorUser({ role: "user" }), false);
  });

  it("only accepts super admins for privileged role management", () => {
    assert.equal(isSuperAdminUser({ role: "super_admin" }), true);
    assert.equal(isSuperAdminUser({ role: "admin" }), false);
    assert.equal(isSuperAdminUser({ role: "moderator" }), false);
  });

  it("allows moderators only through the report moderation gate", () => {
    const moderationResult = runMiddleware(requireModerator, "moderator");
    assert.equal(moderationResult.nextCalled, true);

    const adminResult = runMiddleware(requireAdmin, "moderator");
    assert.equal(adminResult.nextCalled, false);
    assert.equal(adminResult.res.statusCode, 403);
    assert.equal(adminResult.res.payload.code, "ADMIN_REQUIRED");
  });

  it("limits privileged role management to super admins", () => {
    const adminResult = runMiddleware(requireSuperAdmin, "admin");
    assert.equal(adminResult.nextCalled, false);
    assert.equal(adminResult.res.statusCode, 403);
    assert.equal(adminResult.res.payload.code, "SUPER_ADMIN_REQUIRED");

    const superAdminResult = runMiddleware(requireSuperAdmin, "super_admin");
    assert.equal(superAdminResult.nextCalled, true);
  });
});
