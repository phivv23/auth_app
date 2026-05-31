import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateReportInput,
  validateReportStatusInput,
} from "../src/models/report.model.js";

describe("report validation", () => {
  it("normalizes valid report input", () => {
    const result = validateReportInput({
      targetType: "post",
      targetId: "12",
      reason: "spam",
      details: "  duplicate content  ",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      targetType: "post",
      targetId: 12,
      reason: "spam",
      details: "duplicate content",
    });
  });

  it("rejects invalid target and reason", () => {
    const result = validateReportInput({
      targetType: "photo",
      targetId: 0,
      reason: "bad",
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields).sort(), [
      "reason",
      "targetId",
      "targetType",
    ]);
  });

  it("normalizes valid status updates", () => {
    const result = validateReportStatusInput({
      status: "resolved",
      resolutionNote: "  handled by moderator  ",
    });

    assert.equal(result.error, null);
    assert.deepEqual(result.value, {
      status: "resolved",
      resolutionNote: "handled by moderator",
    });
  });

  it("rejects invalid status updates", () => {
    const result = validateReportStatusInput({
      status: "closed",
      resolutionNote: "x".repeat(2001),
    });

    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields).sort(), [
      "resolutionNote",
      "status",
    ]);
  });
});
