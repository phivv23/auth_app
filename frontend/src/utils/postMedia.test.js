import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPostMediaFileErrors,
  postMediaErrorMessage,
  validatePostMediaFiles,
} from "./postMedia.js";

describe("post media validation", () => {
  it("keeps the legacy validation message while exposing per-file errors", () => {
    const files = [
      {
        name: "avatar.gif",
        type: "image/gif",
        size: 1200,
      },
      {
        name: "large.jpg",
        type: "image/jpeg",
        size: 6 * 1024 * 1024,
      },
    ];

    const errors = getPostMediaFileErrors(files);

    assert.equal(validatePostMediaFiles(files), postMediaErrorMessage);
    assert.equal(errors.length, 2);
    assert.equal(errors[0].name, "avatar.gif");
    assert.match(errors[0].message, /chưa được hỗ trợ/i);
    assert.equal(errors[1].name, "large.jpg");
    assert.match(errors[1].message, /5MB/);
  });

  it("accepts valid image and video files", () => {
    const errors = getPostMediaFileErrors([
      {
        name: "photo.jpg",
        type: "image/jpeg",
        size: 2 * 1024 * 1024,
      },
      {
        name: "clip.mp4",
        type: "video/mp4",
        size: 24 * 1024 * 1024,
      },
    ]);

    assert.deepEqual(errors, []);
  });
});
