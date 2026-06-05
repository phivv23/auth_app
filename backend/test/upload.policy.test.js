import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createUploadFilename,
  getSafeUploadExtension,
  isAllowedMimeType,
  MESSAGE_MEDIA_MIME_TYPES,
  sanitizeUploadDisplayName,
} from "../src/config/upload.js";

describe("upload policy", () => {
  it("allows approved message media MIME types and rejects unknown types", () => {
    assert.equal(
      isAllowedMimeType("text/plain", MESSAGE_MEDIA_MIME_TYPES),
      true
    );
    assert.equal(
      isAllowedMimeType(
        "application/vnd.ms-powerpoint",
        MESSAGE_MEDIA_MIME_TYPES
      ),
      true
    );
    assert.equal(
      isAllowedMimeType("application/x-msdownload", MESSAGE_MEDIA_MIME_TYPES),
      false
    );
  });

  it("maps safe extensions from MIME type", () => {
    assert.equal(getSafeUploadExtension("image/jpeg"), ".jpg");
    assert.equal(getSafeUploadExtension("application/pdf"), ".pdf");
    assert.equal(getSafeUploadExtension("application/x-zip-compressed"), ".zip");
    assert.equal(getSafeUploadExtension("application/octet-stream"), "");
  });

  it("uses a random filename without user id or timestamp structure", () => {
    const filename = createUploadFilename({
      prefix: "message",
      mimetype: "text/plain",
      randomId: () => "11111111-1111-4111-8111-111111111111",
    });

    assert.equal(
      filename,
      "message-11111111-1111-4111-8111-111111111111.txt"
    );
    assert.equal(/^message-\d+-\d+\.txt$/.test(filename), false);
  });

  it("sanitizes display names without using them for disk paths", () => {
    assert.equal(sanitizeUploadDisplayName("..\\secret\n.txt"), "secret_.txt");
    assert.equal(sanitizeUploadDisplayName("../../evil?.pdf"), "evil_.pdf");
  });
});
