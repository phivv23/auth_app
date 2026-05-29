import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateLoginInput,
  validatePasswordChangeInput,
  validateProfileInput,
  validateRegisterInput,
} from "../src/validation/auth.validation.js";

describe("auth validation", () => {
  it("normalizes valid register input", () => {
    const result = validateRegisterInput({
      name: "  Nguyen Van A  ",
      email: "  A@Example.COM ",
      password: "123456",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      name: "Nguyen Van A",
      email: "a@example.com",
      password: "123456",
    });
  });

  it("returns field errors for invalid register input", () => {
    const result = validateRegisterInput({
      name: "A",
      email: "not-an-email",
      password: "123",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields).sort(), [
      "email",
      "name",
      "password",
    ]);
  });

  it("normalizes valid login input", () => {
    const result = validateLoginInput({
      email: " USER@Example.com ",
      password: "secret",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      email: "user@example.com",
      password: "secret",
    });
  });

  it("rejects malformed login email", () => {
    const result = validateLoginInput({
      email: "bad-email",
      password: "secret",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.equal(result.error.fields.email, "Email không hợp lệ.");
  });

});

describe("profile validation", () => {
  it("normalizes valid profile input", () => {
    const result = validateProfileInput({
      name: "  Linh Tran ",
      email: " LINH@Example.com ",
      bio: "  Hello there  ",
      location: "   ",
      website: "example.com/about",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      name: "Linh Tran",
      email: "linh@example.com",
      bio: "Hello there",
      location: null,
      website: "https://example.com/about",
      profilePrivacy: "public",
    });
  });

  it("rejects profile fields that exceed limits", () => {
    const result = validateProfileInput({
      name: "Linh",
      email: "linh@example.com",
      bio: "a".repeat(501),
      location: "b".repeat(101),
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields).sort(), [
      "bio",
      "location",
    ]);
  });

  it("rejects invalid profile privacy values", () => {
    const result = validateProfileInput({
      name: "Linh",
      email: "linh@example.com",
      profilePrivacy: "everyone_except_me",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.equal(
      result.error.fields.profilePrivacy,
      "Quyền riêng tư profile không hợp lệ."
    );
  });

  it("rejects invalid website URLs", () => {
    const result = validateProfileInput({
      name: "Linh",
      email: "linh@example.com",
      website: "https://",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.equal(result.error.fields.website, "Website không hợp lệ.");
  });
});

describe("password validation", () => {
  it("normalizes valid password change input", () => {
    const result = validatePasswordChangeInput({
      currentPassword: "current123",
      newPassword: "next123",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      currentPassword: "current123",
      newPassword: "next123",
    });
  });

  it("rejects short new passwords", () => {
    const result = validatePasswordChangeInput({
      currentPassword: "current123",
      newPassword: "123",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.equal(
      result.error.fields.newPassword,
      "Password mới phải có ít nhất 6 ký tự."
    );
  });

  it("rejects reusing the current password", () => {
    const result = validatePasswordChangeInput({
      currentPassword: "same-password",
      newPassword: "same-password",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.equal(
      result.error.fields.newPassword,
      "Password mới không được giống password hiện tại."
    );
  });
});
