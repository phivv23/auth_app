import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateReportInput } from "../src/models/report.model.js";

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
});
