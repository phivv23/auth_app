import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import express from "express";

import { request, requestRaw } from "./helpers/http.js";

process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "rootpassword";
process.env.DB_NAME ||= "auth_app";
process.env.JWT_SECRET ||= "development_secret_with_enough_length";
process.env.NODE_ENV ||= "test";

const { createRequestLogger } = await import("../src/middleware/requestLogger.js");
const { createMessageMediaRouter } = await import(
  "../src/routes/messageMedia.routes.js"
);
const { getProtectedMessageMediaUrl } = await import(
  "../src/models/message.model.js"
);
const { createApp } = await import("../src/server.js");

function createMediaApp(options = {}) {
  const app = express();
  app.use("/api/messages/media", createMessageMediaRouter(options));
  return app;
}

function createFakeAuth(userId = 7) {
  return (req, res, next) => {
    req.user = {
      id: userId,
      name: "Test User",
    };
    next();
  };
}

function createSilentApp(options = {}) {
  const silentLogger = {
    error() {},
    info() {},
    warn() {},
  };

  return createApp({
    errorLogger: silentLogger,
    requestLogger: createRequestLogger({ logger: silentLogger }),
    ...options,
  });
}

describe("message media route", () => {
  it("serializes stored message upload URLs to protected URLs", () => {
    assert.equal(
      getProtectedMessageMediaUrl("/uploads/messages/message-uuid.txt"),
      "/api/messages/media/message-uuid.txt"
    );
    assert.equal(
      getProtectedMessageMediaUrl("https://media.giphy.com/example.gif"),
      "https://media.giphy.com/example.gif"
    );
  });

  it("requires login before serving message media", async () => {
    const app = createMediaApp();
    const response = await request(app, "/api/messages/media/file.txt");

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "AUTH_REQUIRED");
  });

  it("returns 404 when the current user cannot access the attachment", async () => {
    const app = createMediaApp({
      findAttachment: async () => null,
      requireAuthMiddleware: createFakeAuth(12),
    });
    const response = await request(app, "/api/messages/media/file.txt");

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "MESSAGE_MEDIA_NOT_FOUND");
  });

  it("returns 404 when the source message has been revoked", async () => {
    const app = createMediaApp({
      findAttachment: async () => null,
      requireAuthMiddleware: createFakeAuth(7),
    });
    const response = await request(app, "/api/messages/media/revoked.txt");

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "MESSAGE_MEDIA_NOT_FOUND");
  });

  it("serves authorized attachments with nosniff headers", async () => {
    const uploadDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "message-media-")
    );

    try {
      const filename = "message-authorized.txt";
      await fs.writeFile(path.join(uploadDir, filename), "hello attachment");

      const app = createMediaApp({
        findAttachment: async ({ filename: requestedFilename, userId }) => {
          assert.equal(requestedFilename, filename);
          assert.equal(userId, 7);

          return {
            mediaName: "tệp test.txt",
            mediaType: "file",
            mediaUrl: `/uploads/messages/${filename}`,
          };
        },
        requireAuthMiddleware: createFakeAuth(7),
        uploadDir,
      });
      const response = await requestRaw(
        app,
        `/api/messages/media/${filename}`
      );

      assert.equal(response.status, 200);
      assert.equal(response.text, "hello attachment");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(
        response.headers.get("content-disposition") || "",
        /attachment;/
      );
    } finally {
      await fs.rm(uploadDir, { force: true, recursive: true });
    }
  });

  it("does not serve legacy direct message upload URLs", async () => {
    const response = await request(
      createSilentApp(),
      "/uploads/messages/message-authorized.txt"
    );

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "ROUTE_NOT_FOUND");
  });
});
