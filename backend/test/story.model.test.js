import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateStoryInput } from "../src/models/story.model.js";

describe("story model validation", () => {
  it("normalizes valid story input", () => {
    assert.deepEqual(
      validateStoryInput({
        caption: "  Hôm nay trời đẹp  ",
        privacy: "friends",
      }),
      {
        value: {
          caption: "Hôm nay trời đẹp",
          privacy: "friends",
        },
        error: null,
      }
    );
  });

  it("defaults story privacy to friends", () => {
    assert.deepEqual(validateStoryInput({ caption: "" }), {
      value: {
        caption: "",
        privacy: "friends",
      },
      error: null,
    });
  });

  it("rejects unsupported story privacy", () => {
    const result = validateStoryInput({ privacy: "team" });

    assert.equal(result.value, null);
    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields), ["privacy"]);
  });

  it("rejects long captions", () => {
    const result = validateStoryInput({ caption: "a".repeat(501) });

    assert.equal(result.value, null);
    assert.equal(result.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(result.error.fields), ["caption"]);
  });
});
