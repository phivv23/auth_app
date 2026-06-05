import path from "path";
import { Router } from "express";

import { messageUploadDir, sanitizeUploadDisplayName } from "../config/upload.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { findMessageAttachmentForUser } from "../models/message.model.js";
import { sendError } from "../utils/http.js";

function isSafeUploadFilename(filename) {
  const normalizedFilename = String(filename || "");

  return (
    normalizedFilename.length > 0 &&
    !normalizedFilename.includes("/") &&
    !normalizedFilename.includes("\\") &&
    normalizedFilename === path.basename(normalizedFilename) &&
    normalizedFilename !== "." &&
    normalizedFilename !== ".."
  );
}

function encodeHeaderValue(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function createContentDisposition(mediaName) {
  const displayName = sanitizeUploadDisplayName(mediaName) || "file";
  const asciiFallback = displayName.replace(/[^\x20-\x7e]/g, "_");

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeHeaderValue(displayName)}`;
}

function resolveMediaPath(uploadDir, filename) {
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(resolvedUploadDir, filename);
  const relativePath = path.relative(resolvedUploadDir, resolvedFilePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedFilePath;
}

export function createMessageMediaRouter({
  findAttachment = findMessageAttachmentForUser,
  requireAuthMiddleware = requireAuth,
  uploadDir = messageUploadDir,
} = {}) {
  const router = Router();

  router.get("/:filename", requireAuthMiddleware, async (req, res, next) => {
    try {
      const filename = req.params.filename;

      if (!isSafeUploadFilename(filename)) {
        return sendError(
          res,
          404,
          "Không tìm thấy file.",
          "MESSAGE_MEDIA_NOT_FOUND"
        );
      }

      const attachment = await findAttachment({
        filename,
        userId: req.user.id,
      });

      if (!attachment) {
        return sendError(
          res,
          404,
          "Không tìm thấy file.",
          "MESSAGE_MEDIA_NOT_FOUND"
        );
      }

      const filePath = resolveMediaPath(uploadDir, filename);

      if (!filePath) {
        return sendError(
          res,
          404,
          "Không tìm thấy file.",
          "MESSAGE_MEDIA_NOT_FOUND"
        );
      }

      const headers = {
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      };

      if (attachment.mediaType === "file") {
        headers["Content-Disposition"] = createContentDisposition(
          attachment.mediaName
        );
      }

      return res.sendFile(filePath, { headers }, (error) => {
        if (!error) {
          return;
        }

        if (res.headersSent) {
          return next(error);
        }

        return sendError(
          res,
          404,
          "Không tìm thấy file.",
          "MESSAGE_MEDIA_NOT_FOUND"
        );
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createMessageMediaRouter();
